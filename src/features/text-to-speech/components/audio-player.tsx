"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Download,
  Volume2,
  VolumeOff,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  title,
  subtitle,
  compact = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ── Audio Event Handlers ───────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  // ── Controls ───────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  const restart = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play();
  }, []);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      const bar = progressRef.current;
      if (!audio || !bar || !duration) return;

      const rect = bar.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = percent * duration;
    },
    [duration]
  );

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const v = parseFloat(e.target.value);
    audio.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  }, []);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `sevenlabs-${Date.now()}.wav`;
    a.click();
  }, [src]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={cn(
      "rounded-xl border bg-card",
      compact ? "p-3" : "p-5"
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Title */}
      {(title || subtitle) && !compact && (
        <div className="mb-4">
          {title && (
            <h3 className="text-sm font-medium truncate">{title}</h3>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div
        ref={progressRef}
        onClick={handleSeek}
        className="group relative h-2 cursor-pointer rounded-full bg-foreground/10 mb-3 hover:h-2.5 transition-all"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-foreground transition-all"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          style={{ left: `calc(${progress}% - 7px)` }}
        />
      </div>

      {/* Time */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatTime(currentTime)}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Restart */}
          <button
            type="button"
            onClick={restart}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <RotateCcw className="size-3.5" />
          </button>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="
              flex size-10 items-center justify-center rounded-full
              bg-foreground text-background
              hover:bg-foreground/90 active:scale-95
              transition-all duration-150
            "
          >
            {isPlaying ? (
              <Pause className="size-4" fill="currentColor" />
            ) : (
              <Play className="size-4 ml-0.5" fill="currentColor" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Volume */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeOff className="size-3.5" />
              ) : (
                <Volume2 className="size-3.5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 appearance-none bg-foreground/10 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
            />
          </div>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Download className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
