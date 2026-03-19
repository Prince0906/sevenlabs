import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

function generateWavBuffer(durationSeconds: number): Buffer {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset);
  offset += 4;
  buffer.write("WAVE", offset);
  offset += 4;

  // fmt chunk
  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset);
  offset += 4;
  buffer.writeUInt16LE(1, offset);
  offset += 2;
  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buffer.writeUInt32LE(byteRate, offset);
  offset += 4;
  buffer.writeUInt16LE(blockAlign, offset);
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data chunk
  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset);
  offset += 4;

  // Generate a tone that fades in/out with slight vibrato for a speech-like feel
  const baseFreq = 180;
  const vibratoRate = 5;
  const vibratoDepth = 20;
  const amplitude = 0.4;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;

    // Envelope: fade in first 10%, fade out last 15%
    let envelope = 1;
    if (progress < 0.1) envelope = progress / 0.1;
    else if (progress > 0.85) envelope = (1 - progress) / 0.15;

    const freq = baseFreq + vibratoDepth * Math.sin(2 * Math.PI * vibratoRate * t);
    const sample = amplitude * envelope * Math.sin(2 * Math.PI * freq * t);
    const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));

    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

export async function generateMockAudio(text: string): Promise<{
  filename: string;
  audioUrl: string;
}> {
  const wordCount = text.trim().split(/\s+/).length;
  const duration = Math.min(Math.max(wordCount * 0.15, 1), 10);

  const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.wav`;

  const audioDir = join(process.cwd(), "public", "audio");
  if (!existsSync(audioDir)) {
    await mkdir(audioDir, { recursive: true });
  }

  const wavBuffer = generateWavBuffer(duration);
  await writeFile(join(audioDir, filename), wavBuffer);

  return {
    filename,
    audioUrl: `/audio/${filename}`,
  };
}
