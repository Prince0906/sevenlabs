"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export type GenerationParams = {
  temperature: number;
  topP: number;
  topK: number;
  repetitionPenalty: number;
};

interface GenerationSettingsProps {
  params: GenerationParams;
  onChange: (params: GenerationParams) => void;
}

function SettingRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-muted-foreground font-mono text-xs">
          {Number.isInteger(step) ? value : value.toFixed(2)}
        </span>
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
      />
    </div>
  );
}

export function GenerationSettings({ params, onChange }: GenerationSettingsProps) {
  const update = (key: keyof GenerationParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-medium">Voice Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <SettingRow
          label="Temperature"
          value={params.temperature}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => update("temperature", v)}
        />
        <SettingRow
          label="Top P"
          value={params.topP}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => update("topP", v)}
        />
        <SettingRow
          label="Top K"
          value={params.topK}
          min={1}
          max={100}
          step={1}
          onChange={(v) => update("topK", v)}
        />
        <SettingRow
          label="Repetition Penalty"
          value={params.repetitionPenalty}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => update("repetitionPenalty", v)}
        />
      </CardContent>
    </Card>
  );
}
