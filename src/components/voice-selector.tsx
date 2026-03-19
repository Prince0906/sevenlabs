"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type VoiceOption = {
  id: string;
  name: string;
  category: string;
  variant: string;
  language: string;
};

interface VoiceSelectorProps {
  voices: VoiceOption[];
  value: string;
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
}

function formatCategory(category: string) {
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function VoiceSelector({ voices, value, onValueChange, disabled }: VoiceSelectorProps) {
  const systemVoices = voices.filter((v) => v.variant === "SYSTEM");
  const customVoices = voices.filter((v) => v.variant === "CUSTOM");

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a voice..." />
      </SelectTrigger>
      <SelectContent>
        {systemVoices.length > 0 && (
          <SelectGroup>
            <SelectLabel>System Voices</SelectLabel>
            {systemVoices.map((voice) => (
              <SelectItem key={voice.id} value={voice.id}>
                <span className="flex items-center gap-2">
                  {voice.name}
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {formatCategory(voice.category)}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {customVoices.length > 0 && (
          <SelectGroup>
            <SelectLabel>Custom Voices</SelectLabel>
            {customVoices.map((voice) => (
              <SelectItem key={voice.id} value={voice.id}>
                <span className="flex items-center gap-2">
                  {voice.name}
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {formatCategory(voice.category)}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
