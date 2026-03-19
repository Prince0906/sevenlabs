"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, AudioLines } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

type Voice = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  language: string;
  variant: string;
};

const CATEGORIES = [
  "GENERAL",
  "CONVERSATIONAL",
  "NARRATIVE",
  "AUDIOBOOK",
  "PODCAST",
  "VOICEOVER",
  "CORPORATE",
  "MEDITATION",
  "ADVERTISING",
  "CHARACTERS",
  "CUSTOMER_SERVICE",
  "MOTIVATIONAL",
];

function formatCategory(category: string) {
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function VoiceCard({ voice, onUse }: { voice: Voice; onUse: (id: string) => void }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{voice.name}</span>
          <Badge
            variant={voice.variant === "SYSTEM" ? "secondary" : "outline"}
            className="text-[10px] font-normal"
          >
            {voice.variant === "SYSTEM" ? "System" : "Custom"}
          </Badge>
        </CardTitle>
        {voice.description && (
          <CardDescription className="line-clamp-2">{voice.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-normal">
              {formatCategory(voice.category)}
            </Badge>
            <span className="text-muted-foreground text-xs">{voice.language}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => onUse(voice.id)}>
            Use Voice
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VoicesPage() {
  const router = useRouter();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("GENERAL");
  const [newLanguage, setNewLanguage] = useState("en-US");

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch("/api/voices");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setVoices(data);
    } catch {
      toast.error("Failed to load voices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          category: newCategory,
          language: newLanguage.trim() || "en-US",
        }),
      });

      if (!res.ok) throw new Error("Failed to create voice");

      toast.success("Voice created successfully");
      setDialogOpen(false);
      setNewName("");
      setNewDescription("");
      setNewCategory("GENERAL");
      setNewLanguage("en-US");
      fetchVoices();
    } catch {
      toast.error("Failed to create voice");
    } finally {
      setCreating(false);
    }
  };

  const handleUseVoice = (voiceId: string) => {
    router.push(`/?voice=${voiceId}`);
  };

  const systemVoices = voices.filter((v) => v.variant === "SYSTEM");
  const customVoices = voices.filter((v) => v.variant === "CUSTOM");

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Voice Library</h1>
          <p className="text-muted-foreground text-sm">Browse and manage your voices</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="size-3.5" />
                Add Voice
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Voice</DialogTitle>
              <DialogDescription>Add a new custom voice to your library.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Voice name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe this voice..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newCategory} onValueChange={(v) => setNewCategory(v ?? "GENERAL")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {formatCategory(cat)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Input
                    placeholder="en-US"
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
                {creating ? (
                  <>
                    <Spinner className="size-3.5" />
                    Creating...
                  </>
                ) : (
                  "Create Voice"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Voices ({voices.length})</TabsTrigger>
          <TabsTrigger value="system">System ({systemVoices.length})</TabsTrigger>
          <TabsTrigger value="custom">Custom ({customVoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {voices.length === 0 ? (
            <Empty className="min-h-[300px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AudioLines />
                </EmptyMedia>
                <EmptyTitle>No voices yet</EmptyTitle>
                <EmptyDescription>
                  Create a custom voice or seed system voices to get started.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {voices.map((voice) => (
                <VoiceCard key={voice.id} voice={voice} onUse={handleUseVoice} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system">
          {systemVoices.length === 0 ? (
            <Empty className="min-h-[300px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AudioLines />
                </EmptyMedia>
                <EmptyTitle>No system voices</EmptyTitle>
                <EmptyDescription>Run the seed script to add system voices.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {systemVoices.map((voice) => (
                <VoiceCard key={voice.id} voice={voice} onUse={handleUseVoice} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="custom">
          {customVoices.length === 0 ? (
            <Empty className="min-h-[300px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AudioLines />
                </EmptyMedia>
                <EmptyTitle>No custom voices</EmptyTitle>
                <EmptyDescription>Create your first custom voice to get started.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {customVoices.map((voice) => (
                <VoiceCard key={voice.id} voice={voice} onUse={handleUseVoice} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
