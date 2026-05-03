"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, Target, Shuffle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ParameterControlsProps {
  temperature: number;
  setTemperature: (v: number) => void;
  topP: number;
  setTopP: (v: number) => void;
  topK: number;
  setTopK: (v: number) => void;
  repetitionPenalty: number;
  setRepetitionPenalty: (v: number) => void;
}

// Presets
const PRESETS = [
  {
    name: "Balanced",
    icon: Target,
    values: { temperature: 0.7, topP: 0.9, topK: 50, repetitionPenalty: 1.1 },
  },
  {
    name: "Creative",
    icon: Sparkles,
    values: { temperature: 0.9, topP: 0.95, topK: 80, repetitionPenalty: 1.0 },
  },
  {
    name: "Precise",
    icon: Target,
    values: { temperature: 0.3, topP: 0.7, topK: 20, repetitionPenalty: 1.3 },
  },
  {
    name: "Random",
    icon: Shuffle,
    values: { temperature: 1.0, topP: 1.0, topK: 100, repetitionPenalty: 1.0 },
  },
];

function ParamSlider({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{label}</span>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="tabular-nums text-xs font-mono px-2">
          {value.toFixed(step < 1 ? 1 : 0)}
        </Badge>
      </div>
      <Slider
        value={[value]}
        onValueChange={(val) => {
          const v = Array.isArray(val) ? val[0] : val;
          onChange(v);
        }}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
}

export function ParameterControls({
  temperature,
  setTemperature,
  topP,
  setTopP,
  topK,
  setTopK,
  repetitionPenalty,
  setRepetitionPenalty,
}: ParameterControlsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setTemperature(preset.values.temperature);
    setTopP(preset.values.topP);
    setTopK(preset.values.topK);
    setRepetitionPenalty(preset.values.repetitionPenalty);
  };

  return (
    <div className="rounded-xl border bg-card">
      {/* Toggle Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-accent/30 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Advanced Settings</span>
          <Badge variant="outline" className="text-[10px]">
            Optional
          </Badge>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div className="border-t px-4 pb-5 pt-4 space-y-6">
          {/* Presets */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Presets
            </span>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="
                    flex flex-col items-center gap-1.5 rounded-lg border p-3
                    text-xs font-medium
                    hover:bg-accent/50 hover:border-foreground/20
                    transition-all duration-150
                  "
                >
                  <preset.icon className="size-3.5 text-muted-foreground" />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-5">
            <ParamSlider
              label="Temperature"
              description="Controls randomness and creativity"
              value={temperature}
              onChange={setTemperature}
              min={0.1}
              max={1.0}
              step={0.1}
            />
            <ParamSlider
              label="Top P"
              description="Nucleus sampling threshold"
              value={topP}
              onChange={setTopP}
              min={0.1}
              max={1.0}
              step={0.1}
            />
            <ParamSlider
              label="Top K"
              description="Vocabulary diversity limit"
              value={topK}
              onChange={setTopK}
              min={1}
              max={100}
              step={1}
            />
            <ParamSlider
              label="Repetition Penalty"
              description="Reduces repetitive patterns"
              value={repetitionPenalty}
              onChange={setRepetitionPenalty}
              min={1.0}
              max={2.0}
              step={0.1}
            />
          </div>
        </div>
      )}
    </div>
  );
}
