# Enclii Service Specs

These files are the service-level Enclii source of truth for Dhanam:

- `dhanam-web` serves `app.dhan.am`, `dhan.am`, and `www.dhan.am`.
- `dhanam-api` serves `api.dhan.am`.
- `dhanam-admin` serves `admin.dhan.am`.

Use Enclii-first reconciliation from this directory:

```bash
enclii services-sync --dir infra/enclii/services --project dhanam --reconcile-existing --dry-run
enclii services-sync --dir infra/enclii/services --project dhanam --reconcile-existing
```

Do not run service reconciliation from the repository root. The root
`enclii.yaml` is the domain/status manifest and is consumed separately by the
platform; service reconciliation from `.` will treat it as a deployable service.

The root `.enclii.yml` is retained as the compatibility entrypoint for Enclii's
single-file deploy flow and mirrors `dhanam-web.yaml`.

## Container Build Hygiene

- Keep app Dockerfiles pinned to the repo `packageManager` in `package.json`.
  Dhanam currently uses `pnpm@9.15.0`; older pnpm versions do not reliably
  consume the v9 lockfile in Enclii/Kaniko builds.
- Keep generated output out of the Docker context. The root `.dockerignore`
  excludes app `.next`, `.turbo`, `dist`, `coverage`, Playwright artifacts, and
  generated Prisma output so Enclii builds from source instead of uploading
  local build caches.
