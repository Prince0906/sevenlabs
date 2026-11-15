import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@sevenlabs/backend/infrastructure/db";
import { headers } from "next/headers";
import { backendAuthEnabled } from "./auth-mode";
import { readBackendSession } from "./backend-session";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const legacyAuth = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});

export const handlers = backendAuthEnabled
  ? { GET: async () => Response.json({ error: "Authentication is served by the API" }, { status: 410 }), POST: async () => Response.json({ error: "Authentication is served by the API" }, { status: 410 }) }
  : legacyAuth.handlers;

export async function auth() {
  if (!backendAuthEnabled) return legacyAuth.auth();
  return readBackendSession((await headers()).get("cookie") ?? "");
}
