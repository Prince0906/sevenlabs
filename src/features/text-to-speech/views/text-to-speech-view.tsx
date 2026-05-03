"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TextInputArea } from "@/features/text-to-speech/components/text-input-area";
import { VoiceSelector } from "@/features/text-to-speech/components/voice-selector";
import { ParameterControls } from "@/features/text-to-speech/components/parameter-controls";
import { GenerationOutput } from "@/features/text-to-speech/components/generation-output";
import { generateSpeech } from "@/features/text-to-speech/actions";
import type { VoiceItem } from "@/features/voices/actions";

interface GenerationResult {
  generationId: string;
  audioUrl: string;
  text: string;
  voiceName: string;
  language: string;
}

export function TextToSpeechView() {
  const searchParams = useSearchParams();
  const initialText = searchParams.get("text") ?? "";

  // ── State ──────────────────────────────────────────────────────────────
  const [text, setText] = useState(initialText);
  const [selectedVoice, setSelectedVoice] = useState<VoiceItem | null>(null);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [topK, setTopK] = useState(50);
  const [repetitionPenalty, setRepetitionPenalty] = useState(1.1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Generate Handler ───────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!text.trim() || !selectedVoice) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await generateSpeech({
        text: text.trim(),
        voiceId: selectedVoice.id,
        voiceName: selectedVoice.name,
        language: selectedVoice.language,
        temperature,
        topP,
        topK,
        repetitionPenalty,
      });

      if (!response.success || !response.generationId || !response.audioUrl) {
        setError(response.error ?? "Generation failed");
        return;
      }

      setResult({
        generationId: response.generationId,
        audioUrl: response.audioUrl,
        text: text.trim(),
        voiceName: selectedVoice.name,
        language: selectedVoice.language,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  }, [text, selectedVoice, temperature, topP, topK, repetitionPenalty]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Desktop Header */}
      <header className="hidden lg:flex items-center gap-2 border-b px-6 py-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-5" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Text to Speech</h1>
          <p className="text-xs text-muted-foreground">
            Generate lifelike speech in Hindi, English & more
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:flex-row min-h-0 overflow-auto">
        {/* Left Panel — Input & Controls */}
        <div className="flex flex-col flex-1 min-w-0 border-r-0 lg:border-r lg:max-w-[55%]">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
            <TextInputArea
              text={text}
              setText={setText}
              isGenerating={isGenerating}
            />

            <div className="grid gap-6 md:grid-cols-2">
              <VoiceSelector
                selectedVoice={selectedVoice}
                onSelect={setSelectedVoice}
              />
            </div>

            <ParameterControls
              temperature={temperature}
              setTemperature={setTemperature}
              topP={topP}
              setTopP={setTopP}
              topK={topK}
              setTopK={setTopK}
              repetitionPenalty={repetitionPenalty}
              setRepetitionPenalty={setRepetitionPenalty}
            />
          </div>

          {/* Generate Button — Sticky at bottom */}
          <div className="sticky bottom-0 border-t bg-background/80 backdrop-blur-sm p-4 lg:px-6">
            <button
              onClick={handleGenerate}
              disabled={!text.trim() || !selectedVoice || isGenerating}
              className="
                w-full h-11 rounded-xl font-medium text-sm
                bg-foreground text-background
                hover:bg-foreground/90
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200
                flex items-center justify-center gap-2
              "
            >
              {isGenerating ? (
                <>
                  <span className="inline-block size-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Speech"
              )}
            </button>
          </div>
        </div>

        {/* Right Panel — Output */}
        <div className="flex flex-col flex-1 min-w-0 bg-muted/30">
          <GenerationOutput
            result={result}
            error={error}
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
