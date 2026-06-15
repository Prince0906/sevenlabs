import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/api/auth", "/api/health"];

export const authConfig = {
  pages: { signIn: "/sign-in" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      // "/" is the public marketing landing (exact match — startsWith would
      // make every route public). The authed dashboard lives at /dashboard.
      const isPublic =
        pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));
      if (isPublic) return true;
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      // Carry the display name onto the token so the JWT session exposes it
      // (credentials users otherwise have no name in session.user → the
      // dashboard greeting fell back to the raw email prefix).
      if (user) token.name = user.name ?? null;
      return token;
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
        session.user.name = token.name ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
