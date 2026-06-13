# =============================================================================
# DHANAM API - Production Dockerfile
# =============================================================================
# NestJS API with Prisma ORM
# Part of MADFAM ecosystem - connects to shared PostgreSQL and Redis
# =============================================================================

FROM node:20-alpine AS base

# Install dependencies for native modules (including Python for node-gyp)
RUN apk add --no-cache libc6-compat openssl python3 make g++

# Install the repo-pinned pnpm version so Docker builds understand lockfile v9.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# =============================================================================
# Dependencies Stage
# =============================================================================
FROM base AS deps

# Copy workspace configuration and registry config
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
# Copy Prisma schema for postinstall generate
COPY apps/api/prisma ./apps/api/prisma/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY packages/esg/package.json ./packages/esg/
COPY packages/simulations/package.json ./packages/simulations/

# Set dummy DATABASE_URL for Prisma postinstall script
# Prisma generate runs during install and requires this env var
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# =============================================================================
# Builder Stage
# =============================================================================
FROM base AS builder

COPY --from=deps /app ./
COPY . .

# Build workspace packages that API depends on
WORKDIR /app
RUN pnpm --filter @dhanam/shared build || true
RUN pnpm --filter @dhanam/config build || true
RUN pnpm --filter @dhanam/esg build || true
RUN pnpm --filter @dhanam/simulations build || true

# Generate Prisma client
WORKDIR /app/apps/api
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Build the application
RUN pnpm build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:20-alpine AS runner

# Install openssl for Prisma runtime
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

WORKDIR /app

# Copy the entire workspace node_modules structure (pnpm symlinks require this)
# The API's node_modules has symlinks to ../../node_modules/.pnpm/*
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Copy workspace packages (API depends on @dhanam/shared, @dhanam/config, etc.)
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

# Copy built application to apps/api (matching the expected path structure)
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/generated ./apps/api/generated
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/catalog.yaml ./catalog.yaml
# Ops script for the in-cluster catalog sync job (catalog-sync-job.yaml). It
# reads /app/catalog.yaml and imports the generated Prisma client at
# apps/api/generated; tsx (devDep) is already present in apps/api/node_modules.
COPY --from=builder --chown=nestjs:nodejs /app/scripts/sync-catalog.ts ./scripts/sync-catalog.ts
# prisma.config.ts needed for `prisma migrate deploy` in container
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

# Create symlinks for Prisma module resolution from generated directory
# The generated Prisma client requires @prisma/client-runtime-utils which is in pnpm store
RUN mkdir -p ./apps/api/generated/node_modules/@prisma && \
    ln -sf /app/node_modules/.pnpm/node_modules/@prisma/client-runtime-utils ./apps/api/generated/node_modules/@prisma/client-runtime-utils && \
    chown -R nestjs:nodejs ./apps/api/generated/node_modules

USER nestjs

# Set working directory to where the API expects to run
WORKDIR /app/apps/api

EXPOSE 4300

# Health check (port and path set via env in K8s)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-4300}/v1/monitoring/health || exit 1

CMD ["node", "dist/main.js"]
