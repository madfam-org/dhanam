#!/usr/bin/env tsx
/**
 * OpenAPI export entrypoint — delegates to the Jest e2e harness so decorator
 * metadata is preserved (tsx/esbuild alone breaks Nest DI).
 *
 * Requires PostgreSQL + Redis (pnpm dev:infra) and migrated schema.
 *
 * Usage (from repo root):
 *   pnpm dev:infra
 *   pnpm db:push
 *   pnpm --filter @dhanam/api openapi:export
 *
 * Output: docs/api/openapi.json (gitignored generated artifact)
 */
import { spawnSync } from 'child_process';
import { join } from 'path';

const apiRoot = join(__dirname, '..');
const result = spawnSync(
  'pnpm',
  [
    'exec',
    'jest',
    '--config',
    './test/jest-e2e.json',
    '--runTestsByPath',
    './test/e2e/openapi-export.e2e-spec.ts',
    '--forceExit',
  ],
  { cwd: apiRoot, stdio: 'inherit', env: process.env }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('Wrote docs/api/openapi.json');
