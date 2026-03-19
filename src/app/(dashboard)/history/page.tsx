"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Clock, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

type Generation = {
  id: string;
  text: string;
  voiceName: string;
  audioUrl: string | null;
  temperature: number;
  topP: number;
  topK: number;
  repetitionPenalty: number;
  createdAt: string;
};

function InlinePlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.currentTime = 0;
      audio.play();
    }
    setPlaying(!playing);
  };

  return (
    <>
      <audio ref={audioRef} src={audioUrl} preload="none" />
      <Button variant="ghost" size="icon-xs" onClick={toggle}>
        {playing ? (
          <Pause className="size-3" />
        ) : (
          <Play className="size-3" />
        )}
      </Button>
    </>
  );
}

export default function HistoryPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchGenerations = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/generations?page=${p}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setGenerations(data.generations);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenerations(page);
  }, [fetchGenerations, page]);

  if (loading && generations.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Generation History
        </h1>
        <p className="text-sm text-muted-foreground">
          View your past text-to-speech generations
        </p>
      </div>

      {generations.length === 0 ? (
        <Empty className="min-h-[400px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Clock />
            </EmptyMedia>
            <EmptyTitle>No generations yet</EmptyTitle>
            <EmptyDescription>
              Generate your first speech to see it here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Text</TableHead>
                  <TableHead>Voice</TableHead>
                  <TableHead>Settings</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[60px]">Play</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generations.map((gen) => (
                  <TableRow key={gen.id}>
                    <TableCell className="max-w-[300px]">
                      <span className="line-clamp-2 text-sm">
                        {gen.text}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {gen.voiceName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <span className="font-mono text-xs text-muted-foreground">
                          T:{gen.temperature}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          P:{gen.topP}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(gen.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {gen.audioUrl ? (
                        <InlinePlayer audioUrl={gen.audioUrl} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          --
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  {page > 1 && (
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage(page - 1)}
                        className="cursor-pointer"
                      />
                    </PaginationItem>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={p === page}
                          onClick={() => setPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  {page < totalPages && (
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage(page + 1)}
                        className="cursor-pointer"
                      />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
}
