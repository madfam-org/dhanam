#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const kustomizationPath = path.join(repoRoot, 'infra/k8s/production/kustomization.yaml');
const appName = process.argv[2] || 'dhanam-services';

function readExpectedImages() {
  const text = fs.readFileSync(kustomizationPath, 'utf8');
  const entries = [
    ...text.matchAll(
      /-\s+digest:\s+(sha256:[a-f0-9]+)\n\s+name:\s+(dhanam-[a-z]+)\n\s+newName:\s+([^\n]+)/g
    ),
  ];

  if (entries.length === 0) {
    throw new Error(`No digest-pinned production images found in ${kustomizationPath}`);
  }

  const expected = entries.map((entry) => ({
    shortName: entry[2],
    image: `${entry[3]}@${entry[1]}`,
    digest: entry[1],
  }));

  const requiredImages = ['dhanam-admin', 'dhanam-api', 'dhanam-web'];
  const presentImages = new Set(expected.map((entry) => entry.shortName));
  const missingImages = requiredImages.filter((name) => !presentImages.has(name));
  if (missingImages.length > 0) {
    throw new Error(`Missing production image digests: ${missingImages.join(', ')}`);
  }

  return expected;
}

function readLiveApplication() {
  let output;
  try {
    output = execFileSync('enclii', ['ops', 'apps', 'status', appName, '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? error.stderr : '';
    const detail = String(stderr || error).split('\n')[0];
    throw new Error(`Failed to read ${appName} through Enclii: ${detail}`);
  }

  const payload = JSON.parse(output);
  const app = payload?.data?.applications?.[0];

  if (!app) {
    throw new Error(`Enclii returned no application named ${appName}`);
  }

  return app;
}

function collectLiveImages(app) {
  const images = new Set();

  for (const image of app?.status?.summary?.images || []) {
    images.add(image);
  }

  for (const resource of app?.status?.operationState?.syncResult?.resources || []) {
    for (const image of resource.images || []) {
      images.add(image);
    }
  }

  return images;
}

function main() {
  const expected = readExpectedImages();
  const app = readLiveApplication();
  const liveImages = collectLiveImages(app);
  const health = app?.status?.health?.status;
  const sync = app?.status?.sync?.status;
  const revision = app?.status?.sync?.revision;

  let ok = true;

  console.log(`Production rollout proof for ${appName}`);
  console.log(`Argo health: ${health || '<unknown>'}`);
  console.log(`Argo sync:   ${sync || '<unknown>'}`);
  console.log(`Revision:    ${revision || '<unknown>'}`);

  if (health !== 'Healthy') {
    ok = false;
    console.error(`FAIL health expected Healthy, got ${health || '<unknown>'}`);
  }

  if (sync !== 'Synced') {
    ok = false;
    console.error(`FAIL sync expected Synced, got ${sync || '<unknown>'}`);
  }

  for (const item of expected) {
    const matched = liveImages.has(item.image);
    console.log(`${matched ? 'OK  ' : 'FAIL'} ${item.shortName} ${item.image}`);
    if (!matched) ok = false;
  }

  if (!ok) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
