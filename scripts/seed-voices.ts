import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const systemVoices = [
  {
    name: "Rachel",
    description:
      "A warm and friendly voice, perfect for everyday conversations and customer interactions.",
    category: "CONVERSATIONAL" as const,
    language: "en-US",
  },
  {
    name: "Adam",
    description: "A deep and authoritative voice ideal for narration and storytelling.",
    category: "NARRATIVE" as const,
    language: "en-US",
  },
  {
    name: "Sarah",
    description: "A calm and clear voice suited for audiobooks and long-form content.",
    category: "AUDIOBOOK" as const,
    language: "en-US",
  },
  {
    name: "Marcus",
    description:
      "A professional and polished voice for corporate presentations and business content.",
    category: "CORPORATE" as const,
    language: "en-US",
  },
  {
    name: "Aria",
    description: "An engaging and dynamic voice designed for podcasts and audio content.",
    category: "PODCAST" as const,
    language: "en-US",
  },
  {
    name: "James",
    description: "A smooth and versatile voice perfect for voiceovers and commercial work.",
    category: "VOICEOVER" as const,
    language: "en-US",
  },
  {
    name: "Luna",
    description: "A soothing and gentle voice crafted for meditation and relaxation content.",
    category: "MEDITATION" as const,
    language: "en-US",
  },
  {
    name: "Alex",
    description: "A balanced and natural-sounding voice suitable for any general purpose use.",
    category: "GENERAL" as const,
    language: "en-US",
  },
  {
    name: "Elena",
    description: "An energetic and persuasive voice built for advertising and marketing.",
    category: "ADVERTISING" as const,
    language: "en-US",
  },
  {
    name: "Oliver",
    description: "A warm and expressive voice great for character voices and creative projects.",
    category: "CHARACTERS" as const,
    language: "en-GB",
  },
];

async function main() {
  console.log("Seeding system voices...");

  for (const voice of systemVoices) {
    const existing = await prisma.voice.findFirst({
      where: { name: voice.name, variant: "SYSTEM" },
    });

    if (existing) {
      console.log(`  Skipping "${voice.name}" (already exists)`);
      continue;
    }

    await prisma.voice.create({
      data: { ...voice, variant: "SYSTEM" },
    });
    console.log(`  Created "${voice.name}"`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
