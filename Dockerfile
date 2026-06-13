# ─────────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

# openssl is needed by Prisma on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and Prisma schema (postinstall runs "prisma generate")
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install all dependencies (including devDeps needed for prisma generate)
RUN npm ci

# ─────────────────────────────────────────────────────────────────
# Stage 2: Build the application
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy installed dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full source code
COPY . .

# Build Next.js with standalone output (skipping env validation at build time)
ENV SKIP_ENV_VALIDATION=true
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client (outputs to src/generated/prisma/client)
RUN npx prisma generate

RUN npm run build

# ─────────────────────────────────────────────────────────────────
# Stage 3: Production runner (minimal image)
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only the standalone build output (much smaller than full build)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# IMPORTANT: Next.js standalone does NOT auto-copy custom generated directories.
# We must manually copy the Prisma client that was generated in src/generated/prisma
COPY --from=builder --chown=nextjs:nodejs /app/src/generated/prisma ./src/generated/prisma

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Healthcheck — Docker marks the container healthy/unhealthy from this; the
# deploy workflow also polls /api/health before declaring the roll successful.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "server.js"]
