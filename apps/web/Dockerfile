# syntax=docker/dockerfile:1.7
# =============================================================================
# DHANAM WEB - Production Dockerfile
# =============================================================================
# Next.js frontend application
# Part of MADFAM ecosystem - connects to Dhanam API and Janua Auth
# =============================================================================

FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Install the repo-pinned pnpm version. The lockfile is v9, so older pnpm
# releases fail Enclii/Kaniko builds even when local CI package builds pass.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# =============================================================================
# Dependencies Stage
# =============================================================================
FROM base AS deps

# Copy workspace configuration and ALL package.json files
# pnpm needs the full workspace context for correct dependency resolution
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY apps/admin/package.json ./apps/admin/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY packages/ui/package.json ./packages/ui/
COPY packages/esg/package.json ./packages/esg/
COPY packages/simulations/package.json ./packages/simulations/
COPY packages/billing-sdk/package.json ./packages/billing-sdk/

# Install dependencies (DATABASE_URL needed for Prisma generate postinstall).
# The web app depends on private MADFAM packages; pass npm auth as a BuildKit
# secret so the token is not baked into an image layer.
RUN --mount=type=secret,id=npm_madfam_token,required=true \
    set -eu; \
    token="$(cat /run/secrets/npm_madfam_token)"; \
    printf '\n//npm.madfam.io/:_authToken=%s\n' "$token" >> .npmrc; \
    DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm install --frozen-lockfile; \
    rm -f .npmrc

# =============================================================================
# Builder Stage
# =============================================================================
FROM base AS builder

COPY --from=deps /app ./
COPY . .

# Build workspace packages that web depends on
WORKDIR /app
RUN pnpm --filter @dhanam/shared build || true
RUN pnpm --filter @dhanam/config build || true
RUN pnpm --filter @dhanam/ui build || true

# Build arguments for Next.js (OSS-compliant: no hardcoded URLs)
# These are injected at build-time by the CI/CD system (Enclii/Kaniko)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_OIDC_ISSUER
ARG NEXT_PUBLIC_OIDC_CLIENT_ID
ARG NEXT_PUBLIC_JANUA_API_URL
ARG NEXT_PUBLIC_HERO_IPAD_ENABLED=false
ARG NEXT_PUBLIC_HERO_IPAD_3D=true
# next.config.js validates env at build time; Enclii/Kaniko injects NEXT_PUBLIC_*
# via ARG above but must not fail when optional vars are absent during image build.
ARG SKIP_ENV_VALIDATION=true

# Persist build-args as ENV for Next.js build process
ENV SKIP_ENV_VALIDATION=$SKIP_ENV_VALIDATION
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_OIDC_ISSUER=$NEXT_PUBLIC_OIDC_ISSUER
ENV NEXT_PUBLIC_OIDC_CLIENT_ID=$NEXT_PUBLIC_OIDC_CLIENT_ID
ENV NEXT_PUBLIC_JANUA_API_URL=$NEXT_PUBLIC_JANUA_API_URL
ENV NEXT_PUBLIC_HERO_IPAD_ENABLED=$NEXT_PUBLIC_HERO_IPAD_ENABLED
ENV NEXT_PUBLIC_HERO_IPAD_3D=$NEXT_PUBLIC_HERO_IPAD_3D

WORKDIR /app/apps/web
RUN pnpm build

# Debug: Show standalone structure (remove after confirming it works)
RUN ls -la .next/standalone/ && ls -la .next/standalone/apps/web/ 2>/dev/null || true

# =============================================================================
# Production Stage
# =============================================================================
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy built application (monorepo standalone structure)
# In monorepo, standalone includes the full path structure
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone/ ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 4200

ENV PORT=4200
ENV HOSTNAME="0.0.0.0"

# In monorepo standalone, server.js is at apps/web/server.js
CMD ["node", "apps/web/server.js"]
