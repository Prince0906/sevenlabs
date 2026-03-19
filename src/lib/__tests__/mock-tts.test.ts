import { describe, it, expect, afterEach } from "vitest";
import { existsSync, unlinkSync, rmSync } from "fs";
import { join } from "path";
import { generateMockAudio } from "@/lib/mock-tts";

const audioDir = join(process.cwd(), "public", "audio");

describe("generateMockAudio", () => {
  const createdFiles: string[] = [];

  afterEach(() => {
    for (const f of createdFiles) {
      if (existsSync(f)) unlinkSync(f);
    }
    createdFiles.length = 0;
  });

  it("returns a filename and audioUrl", async () => {
    const result = await generateMockAudio("Hello world");
    createdFiles.push(join(audioDir, result.filename));

    expect(result.filename).toMatch(/^gen_\d+_[a-z0-9]+\.wav$/);
    expect(result.audioUrl).toBe(`/audio/${result.filename}`);
  });

  it("creates a valid WAV file on disk", async () => {
    const result = await generateMockAudio("Test audio generation");
    const filePath = join(audioDir, result.filename);
    createdFiles.push(filePath);

    expect(existsSync(filePath)).toBe(true);
  });

  it("generates a WAV file with valid RIFF header", async () => {
    const result = await generateMockAudio("Check WAV header");
    const filePath = join(audioDir, result.filename);
    createdFiles.push(filePath);

    const fs = await import("fs");
    const buffer = fs.readFileSync(filePath);

    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buffer.toString("ascii", 8, 12)).toBe("WAVE");
    expect(buffer.toString("ascii", 12, 16)).toBe("fmt ");
    expect(buffer.readUInt16LE(20)).toBe(1); // PCM format
    expect(buffer.readUInt16LE(22)).toBe(1); // mono
    expect(buffer.readUInt32LE(24)).toBe(44100); // sample rate
  });

  it("scales duration with word count", async () => {
    const shortResult = await generateMockAudio("Hi");
    const longResult = await generateMockAudio(
      "This is a much longer sentence with many more words in it for testing"
    );

    const shortPath = join(audioDir, shortResult.filename);
    const longPath = join(audioDir, longResult.filename);
    createdFiles.push(shortPath, longPath);

    const fs = await import("fs");
    const shortSize = fs.statSync(shortPath).size;
    const longSize = fs.statSync(longPath).size;

    expect(longSize).toBeGreaterThan(shortSize);
  });

  it("is idempotent - calling twice produces two different files", async () => {
    const result1 = await generateMockAudio("Same text");
    const result2 = await generateMockAudio("Same text");

    createdFiles.push(join(audioDir, result1.filename), join(audioDir, result2.filename));

    expect(result1.filename).not.toBe(result2.filename);
  });
});
