"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { Check, ChevronsUpDown, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getVoices, type VoiceItem } from "@/features/voices/actions";

interface VoiceSelectorProps {
  selectedVoice: VoiceItem | null;
  onSelect: (voice: VoiceItem) => void;
}

// Group voices by language
function groupByLanguage(voices: VoiceItem[]) {
  const groups: Record<string, VoiceItem[]> = {};
  for (const voice of voices) {
    const label = voice.language === "hi" ? "🇮🇳 Hindi" : "🇺🇸 English";
    if (!groups[label]) groups[label] = [];
    groups[label].push(voice);
  }
  return groups;
}

// Category display
const categoryLabels: Record<string, string> = {
  GENERAL: "General",
  NARRATIVE: "Narrative",
  CONVERSATIONAL: "Conversational",
  CORPORATE: "Corporate",
  AUDIOBOOK: "Audiobook",
  PODCAST: "Podcast",
  ADVERTISING: "Advertising",
  MEDITATION: "Meditation",
  CUSTOMER_SERVICE: "Support",
  CHARACTERS: "Characters",
  MOTIVATIONAL: "Motivational",
  VOICEOVER: "Voiceover",
};

export function VoiceSelector({ selectedVoice, onSelect }: VoiceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startTransition(async () => {
      const data = await getVoices();
      setVoices(data);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Filter voices by search
  const filteredVoices = search
    ? voices.filter(
        (v) =>
          v.name.toLowerCase().includes(search.toLowerCase()) ||
          v.category.toLowerCase().includes(search.toLowerCase())
      )
    : voices;

  const filteredGrouped = groupByLanguage(filteredVoices);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Voice</label>

      {isPending ? (
        <Skeleton className="h-10 w-full rounded-xl" />
      ) : (
        <div className="relative" ref={containerRef}>
          {/* Trigger Button */}
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="
              w-full flex items-center justify-between rounded-xl h-11 px-4
              text-sm border bg-background
              hover:bg-accent/50
              transition-colors
            "
          >
            {selectedVoice ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7 items-center justify-center rounded-lg bg-foreground/5">
                  <Volume2 className="size-3.5 text-foreground/60" />
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate font-medium text-[13px]">
                    {selectedVoice.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedVoice.language === "hi" ? "Hindi" : "English"} · {categoryLabels[selectedVoice.category] ?? selectedVoice.category}
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">Select a voice...</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-lg overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="Search voices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Voice List */}
              <div className="max-h-64 overflow-y-auto p-1">
                {Object.entries(filteredGrouped).length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No voices found.</p>
                ) : (
                  Object.entries(filteredGrouped).map(([langLabel, langVoices]) => (
                    <div key={langLabel}>
                      <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                        {langLabel}
                      </p>
                      {langVoices.map((voice) => (
                        <button
                          key={voice.id}
                          type="button"
                          onClick={() => {
                            onSelect(voice);
                            setOpen(false);
                            setSearch("");
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex size-8 items-center justify-center rounded-lg bg-foreground/5">
                            <Volume2 className="size-3.5 text-foreground/60" />
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{voice.name}</span>
                              {voice.variant === "CUSTOM" && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Custom
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate">
                              {categoryLabels[voice.category] ?? voice.category}
                              {voice.description ? ` · ${voice.description.slice(0, 50)}` : ""}
                            </span>
                          </div>
                          <Check
                            className={cn(
                              "size-4 shrink-0",
                              selectedVoice?.id === voice.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
