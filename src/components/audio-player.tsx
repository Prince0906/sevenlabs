"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface AudioPlayerProps {
  src: string;
  label?: string;
  className?: string;
}

export function AudioPlayer({ src, label, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-background px-3 py-2",
        className
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90"
      >
        {playing ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="ml-0.5 size-3.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        {label && (
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
        )}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={(e) => {
            const a = audioRef.current;
            if (a) a.currentTime = Number(e.target.value);
          }}
          aria-label="Seek"
          className="mt-1 h-1 w-full cursor-pointer accent-foreground"
        />
      </div>

      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {formatTime(current)} / {formatTime(duration)}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() =>
          setDuration(audioRef.current?.duration ?? 0)
        }
      />
    </div>
  );
}
