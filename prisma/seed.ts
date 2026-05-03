import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ─── System Voice Seeds ──────────────────────────────────────────────────────

const SYSTEM_VOICES = [
  {
    name: "Aria",
    description: "Clear, professional female voice with a natural American accent. Perfect for corporate presentations and general-purpose narration.",
    category: "GENERAL" as const,
    language: "en-US",
    chatterboxVoiceId: "default",
    previewText: "Hello, I'm Aria. I can help you create clear and professional audio for any purpose.",
  },
  {
    name: "Marcus",
    description: "Deep, warm male narrator with a rich tone. Ideal for audiobooks, storytelling, and long-form content.",
    category: "NARRATIVE" as const,
    language: "en-US",
    chatterboxVoiceId: "default",
    previewText: "In the beginning, there was silence. And then, there was a story waiting to be told.",
  },
  {
    name: "Priya",
    description: "Natural Hindi conversational voice with a warm and friendly tone. Great for everyday dialogue and casual content.",
    category: "CONVERSATIONAL" as const,
    language: "hi",
    chatterboxVoiceId: "default",
    previewText: "नमस्ते, मैं प्रिया हूँ। मैं हिंदी में बात कर सकती हूँ और आपकी मदद कर सकती हूँ।",
  },
  {
    name: "Raj",
    description: "Professional Hindi male voice with clear diction. Well-suited for corporate communications and formal presentations.",
    category: "CORPORATE" as const,
    language: "hi",
    chatterboxVoiceId: "default",
    previewText: "आज की प्रस्तुति में हम नई तकनीक और उसके फायदों पर चर्चा करेंगे।",
  },
  {
    name: "Ananya",
    description: "Expressive Hindi storytelling voice with emotional depth. Perfect for audiobooks, podcasts, and narrative content.",
    category: "AUDIOBOOK" as const,
    language: "hi",
    chatterboxVoiceId: "default",
    previewText: "एक समय की बात है, एक छोटे से गाँव में एक बुद्धिमान बूढ़ा रहता था।",
  },
  {
    name: "Zara",
    description: "Energetic, friendly podcast host voice. Brings enthusiasm and engagement to every episode introduction.",
    category: "PODCAST" as const,
    language: "en-US",
    chatterboxVoiceId: "default",
    previewText: "Hey everyone, welcome back to another exciting episode! Today we have something really special lined up.",
  },
  {
    name: "Dev",
    description: "Bold, attention-grabbing Hindi voice. Designed for advertisements, promotions, and marketing content.",
    category: "ADVERTISING" as const,
    language: "hi",
    chatterboxVoiceId: "default",
    previewText: "नया ऑफर! सिर्फ आज के लिए, सभी प्रोडक्ट्स पर 50% की छूट। अभी ऑर्डर करें!",
  },
  {
    name: "Luna",
    description: "Calm, soothing female voice with a gentle pace. Crafted for meditation, relaxation, and wellness content.",
    category: "MEDITATION" as const,
    language: "en-US",
    chatterboxVoiceId: "default",
    previewText: "Close your eyes and take a deep breath. Feel the tension leaving your body with each exhale.",
  },
];

// ─── Seed Script ─────────────────────────────────────────────────────────────

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding system voices...\n");

  for (const voice of SYSTEM_VOICES) {
    const existing = await prisma.voice.findFirst({
      where: {
        name: voice.name,
        variant: "SYSTEM",
      },
    });

    if (existing) {
      console.log(`  ⏭️  "${voice.name}" already exists, skipping`);
      continue;
    }

    await prisma.voice.create({
      data: {
        ...voice,
        variant: "SYSTEM",
      },
    });

    const flag = voice.language === "hi" ? "🇮🇳" : "🇺🇸";
    console.log(`  ✅ Created "${voice.name}" ${flag} [${voice.category}]`);
  }

  console.log(`\n🎉 Seeding complete! ${SYSTEM_VOICES.length} system voices ready.\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
