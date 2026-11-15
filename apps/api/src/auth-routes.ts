import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { readIdentity, type IdentityAuth } from "@sevenlabs/backend/identity/auth";

/** HTTP adaptation only. Authentication and policy live in the identity module. */
export function registerIdentityRoutes(server: FastifyInstance, auth: IdentityAuth) {
  server.register(async (routes) => {
    routes.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => done(null, body));
    routes.route({
      method: ["GET", "POST"], url: "/api/auth/*", bodyLimit: 16 * 1024,
      async handler(request, reply) {
        const incoming = new URL(request.url, "http://internal.invalid");
        const url = new URL(auth.options.baseURL as string);
        // Login has no existing cookie, so do not rely on cookie-dependent
        // library CSRF checks. This browser API requires its exact public origin
        // for every POST, including unauthenticated login and registration.
        if (request.method === "POST" && request.headers.origin !== url.origin) {
          return reply.code(403).send({ error: "Forbidden origin" });
        }
        url.pathname = incoming.pathname;
        url.search = incoming.search;
        const headers = fromNodeHeaders(request.headers);
        // Never let client-supplied forwarding/host headers redefine identity's
        // origin or its rate-limit address. Fastify owns trusted proxy resolution.
        for (const name of ["forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-for", "x-real-ip", "content-length"]) headers.delete(name);
        headers.set("host", url.host);
        headers.set("x-aloud-client-ip", request.ip);
        const response = await auth.handler(new Request(url, {
          method: request.method,
          headers,
          ...(request.method === "POST" && request.body !== undefined
            ? { body: typeof request.body === "string" ? request.body : JSON.stringify(request.body) } : {}),
        }));
        reply.code(response.status);
        response.headers.forEach((value, name) => {
          if (name.toLowerCase() !== "set-cookie") reply.header(name, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) reply.header("set-cookie", cookies);
        return reply.send(response.body ? await response.text() : null);
      },
    });
    routes.get("/api/user/session", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const user = await readIdentity(auth, fromNodeHeaders(request.headers));
      return user ? { user } : reply.code(401).send({ error: "Unauthorized" });
    });
  });
}
