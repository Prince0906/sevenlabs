import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;

// Auth.js handlers use Node features (Prisma adapter); keep this route on Node runtime.
export const runtime = "nodejs";
