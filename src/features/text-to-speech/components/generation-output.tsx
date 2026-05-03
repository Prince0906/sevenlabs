"use client";

import {
  AudioLines,
  AlertCircle,
  RotateCcw,
  Volume2,
  Languages,
  Type,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/features/text-to-speech/components/audio-player";

interface GenerationResult {
  generationId: string;
  audioUrl: string;
  text: string;
  voiceName: string;
  language: string;
}

interface GenerationOutputProps {
  result: GenerationResult | null;
  error: string | null;
  isGenerating: boolean;
}

export function GenerationOutput({
  result,
  error,
  isGenerating,
}: GenerationOutputProps) {
  // ── Loading State ──────────────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="relative">
          {/* Pulsing rings */}
          <div className="absolute inset-0 animate-ping rounded-full bg-foreground/5" />
          <div className="relative flex size-16 items-center justify-center rounded-full bg-foreground/5">
            <AudioLines className="size-6 text-foreground/40 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Generating speech...</p>
          <p className="text-xs text-muted-foreground">
            This may take a few seconds depending on text length
          </p>
        </div>

        {/* Animated dots */}
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="size-1.5 rounded-full bg-foreground/30 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-6 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Generation failed</p>
          <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RotateCcw className="size-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  // ── Result State ───────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex flex-1 flex-col p-4 lg:p-6 space-y-6">
        {/* Success Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <AudioLines className="size-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Speech Generated</h3>
            <p className="text-xs text-muted-foreground">
              Your audio is ready to play and download
            </p>
          </div>
        </div>

        {/* Audio Player */}
        <AudioPlayer
          src={result.audioUrl}
          title={result.voiceName}
          subtitle={`${result.language === "hi" ? "Hindi" : "English"} · ${result.text.length} characters`}
        />

        {/* Metadata */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Generation Details
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Volume2 className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Voice</span>
              <Badge variant="secondary" className="text-[11px] ml-auto">
                {result.voiceName}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Languages className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Language</span>
              <Badge variant="secondary" className="text-[11px] ml-auto">
                {result.language === "hi" ? "🇮🇳 Hindi" : "🇺🇸 English"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Type className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Characters</span>
              <Badge variant="secondary" className="text-[11px] tabular-nums ml-auto">
                {result.text.length.toLocaleString()}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Generated</span>
              <Badge variant="secondary" className="text-[11px] ml-auto">
                Just now
              </Badge>
            </div>
          </div>
        </div>

        {/* Text Preview */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Source Text
          </h4>
          <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4">
            {result.text}
          </p>
        </div>
      </div>
    );
  }

  // ── Empty State ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="relative">
        <div className="flex size-20 items-center justify-center rounded-2xl bg-foreground/[0.03] border border-dashed">
          <AudioLines className="size-8 text-foreground/20" />
        </div>
      </div>
      <div className="text-center space-y-1.5 max-w-xs">
        <p className="text-sm font-medium text-foreground/70">
          Generate your first speech
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Type or paste text, select a voice, and click &quot;Generate Speech&quot; to create lifelike audio
        </p>
      </div>
      <div className="flex gap-2">
        <Badge variant="outline" className="text-[11px] gap-1">
          🇮🇳 Hindi
        </Badge>
        <Badge variant="outline" className="text-[11px] gap-1">
          🇺🇸 English
        </Badge>
        <Badge variant="outline" className="text-[11px] gap-1">
          🎭 Voice Cloning
        </Badge>
      </div>
    </div>
  );
}
