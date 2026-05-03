"use client";

import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  COST_PER_UNIT,
  TEXT_MAX_LENGTH,
} from "@/features/text-to-speech/data/constants";

interface TextInputAreaProps {
  text: string;
  setText: (text: string) => void;
  isGenerating: boolean;
}

export function TextInputArea({
  text,
  setText,
  isGenerating,
}: TextInputAreaProps) {
  // Simple language detection for Hindi/English badge
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const detectedLang = text.trim()
    ? hasDevanagari
      ? "हिन्दी"
      : "English"
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Text</label>
        {detectedLang && (
          <Badge
            variant="secondary"
            className="gap-1 text-[11px] font-normal"
          >
            {hasDevanagari ? "🇮🇳" : "🇺🇸"} {detectedLang} detected
          </Badge>
        )}
      </div>

      <div className="relative">
        <Textarea
          placeholder="Start typing or paste your text here...

Try Hindi: नमस्ते, मैं सेवन लैब्स हूँ
Or English: Hello, I am Seven Labs"
          className="
            min-h-48 resize-none rounded-xl border bg-card p-4
            text-[15px] leading-relaxed
            placeholder:text-muted-foreground/50
            focus-visible:ring-2 focus-visible:ring-foreground/10
            transition-shadow duration-200
          "
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={TEXT_MAX_LENGTH}
          disabled={isGenerating}
        />
      </div>

      {/* Bottom info bar */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="gap-1.5 border-dashed">
          <Coins className="size-3 text-chart-5" />
          <span className="text-xs">
            {text.length === 0 ? (
              "Start typing to estimate"
            ) : (
              <>
                <span className="tabular-nums">
                  ${(text.length * COST_PER_UNIT).toFixed(4)}
                </span>{" "}
                estimated
              </>
            )}
          </span>
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">
          {text.length.toLocaleString()} / {TEXT_MAX_LENGTH.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
