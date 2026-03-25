"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Mic } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";

import { VoiceSelector, type VoiceOption } from "@/components/voice-selector";
import {
  GenerationSettings,
  type GenerationParams,
} from "@/components/generation-settings";
import { AudioPlayer } from "@/components/audio-player";

const DEFAULT_PARAMS: GenerationParams = {
  temperature: 0.7,
  topP: 0.9,
  topK: 50,
  repetitionPenalty: 1.0,
};

type GenerationResult = {
  audioUrl: string;
  voiceName: string;
  text: string;
};

export default function SpeechSynthesisPage() {
  const searchParams = useSearchParams();
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [text, setText] = useState("");
  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch("/api/voices");
      if (!res.ok) throw new Error("Failed to fetch voices");
      const data = await res.json();
      setVoices(data);
      const voiceParam = searchParams.get("voice");
      if (voiceParam && data.some((v: VoiceOption) => v.id === voiceParam)) {
        setSelectedVoice(voiceParam);
      }
    } catch {
      toast.error("Failed to load voices");
    } finally {
      setLoadingVoices(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const handleGenerate = async () => {
    if (!text.trim() || !selectedVoice) return;

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoice,
          ...params,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      setResult({
        audioUrl: data.audioUrl,
        voiceName: data.voiceName,
        text: data.text,
      });
      toast.success("Audio generated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const charCount = text.length;
  const canGenerate = text.trim().length > 0 && selectedVoice && !isGenerating;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Speech Synthesis
        </h1>
        <p className="text-sm text-muted-foreground">
          Convert text to natural-sounding speech
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Text to Speech
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Voice</Label>
                {loadingVoices ? (
                  <div className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="size-3.5" />
                    Loading voices...
                  </div>
                ) : (
                  <VoiceSelector
                    voices={voices}
                    value={selectedVoice}
                    onValueChange={(v) => setSelectedVoice(v ?? "")}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Text</Label>
                  <span className="text-xs text-muted-foreground">
                    {charCount} characters
                  </span>
                </div>
                <Textarea
                  placeholder="Start typing or paste your text here..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[160px] resize-none"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                {isGenerating ? (
                  <>
                    <Spinner className="size-3.5" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Mic className="size-3.5" />
                    Generate Speech
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <AudioPlayer
              audioUrl={result.audioUrl}
              voiceName={result.voiceName}
              text={result.text}
            />
          )}
        </div>

        <div className="space-y-4">
          <GenerationSettings params={params} onChange={setParams} />
        </div>
      </div>
    </div>
  );
}
