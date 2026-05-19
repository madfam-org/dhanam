# SOC 2 Type II Readiness Audit — Dhanam Ledger

**Date:** 2026-02-01
**Scope:** Full codebase audit against SOC 2 Type II Trust Service Criteria
**Categories:** Security, Availability, Processing Integrity, Confidentiality, Privacy

---

## 1. Executive Summary

**Overall Readiness Score: 6.5 / 10**

Dhanam Ledger has strong cryptographic foundations and a well-structured authentication system. Argon2id password hashing, AES-256-GCM token encryption, JWT rotation, TOTP 2FA, HMAC webhook verification, and comprehensive audit logging demonstrate security-first engineering. However, critical operational controls required for SOC 2 Type II attestation are missing: no automated backups, no data retention policies, no KMS integration, no incident response plan, and client-side token storage vulnerable to XSS.

**Summary by Trust Service Criteria:**

| Criteria                             | Score | Status  |
| ------------------------------------ | ----- | ------- |
| CC6 — Logical & Physical Access      | 6/10  | Partial |
| CC7 — System Operations & Monitoring | 6/10  | Partial |
| CC8 — Change Management              | 8/10  | Pass    |
| CC9 — Risk Management                | 4/10  | Fail    |
| A1 — Availability                    | 2/10  | Fail    |
| PI1 — Processing Integrity           | 7/10  | Partial |
| C1 — Confidentiality                 | 6/10  | Partial |
| P1 — Privacy                         | 3/10  | Fail    |

---

## 2. Trust Service Criteria Matrix

### CC6 — Logical & Physical Access Controls

| Control                         | Status      | Evidence                                                                                           | Gap                                                                                                       |
| ------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| CC6.1 Logical access security   | **PASS**    | JWT auth with short-lived tokens (15m), RBAC guards, multi-tenant space isolation via `SpaceGuard` | `RolesGuard` has incomplete implementation (TODO in code)                                                 |
| CC6.2 Authentication mechanisms | **PARTIAL** | Argon2id (64MB/3iter/4par), TOTP 2FA with hashed backup codes, one-time-use refresh tokens (30d)   | No HIBP breach detection, no account lockout after failed attempts, admin 2FA not enforced at guard level |
| CC6.3 Periodic access review    | **FAIL**    | —                                                                                                  | No automated or manual access review mechanism exists                                                     |
| CC6.6 Boundary protection       | **PARTIAL** | Helmet middleware, CORS configuration, rate limiting via `ThrottlerModule`                         | Rate limiting is in-memory only (not distributed), no CSRF token middleware                               |
| CC6.7 Encryption controls       | **PARTIAL** | AES-256-GCM for provider tokens at rest, HTTPS enforced in production                              | TOTP secrets stored in plaintext in DB, no HSTS header, no KMS, no key rotation                           |
| CC6.8 Key management            | **FAIL**    | Encryption keys sourced from environment variables only                                            | No KMS integration, no key versioning, no rotation mechanism, fallback generates random key at startup    |

**Evidence Files:**

- `apps/api/src/core/auth/auth.service.ts` — Argon2id hashing, JWT issuance, refresh rotation
- `apps/api/src/core/auth/totp.service.ts` — TOTP generation, verification, backup codes
- `apps/api/src/core/auth/session.service.ts` — Session management, refresh token lifecycle
- `apps/api/src/core/auth/guards/` — JWT guard, roles guard, space guard
- `apps/api/src/core/auth/strategies/` — JWT and local strategies
- `apps/api/src/core/crypto/crypto.service.ts` — AES-256-GCM encrypt/decrypt
- `apps/api/src/core/security/rate-limiting.module.ts` — Throttle configuration
- `apps/api/src/core/security/guards/` — Throttle guards
- `apps/api/src/main.ts` — Helmet, CORS, validation pipe, rate limit config

---

### CC7 — System Operations & Monitoring

| Control                 | Status      | Evidence                                                                              | Gap                                                                                       |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| CC7.1 Audit logging     | **PASS**    | `AuditService` with DB persistence, severity levels, actor tracking, PII sanitization | No log retention policy, no tamper-evidence signing, no audit log export API              |
| CC7.2 System monitoring | **PASS**    | Sentry error tracking, health check endpoints, metrics service, deployment monitor    | Metrics are in-memory only, no PagerDuty/OpsGenie alerting integration                    |
| CC7.3 Anomaly detection | **PARTIAL** | Error rate tracking, rate limiting                                                    | No account lockout on repeated failures, no session anomaly detection, no geo-IP alerting |
| CC7.4 Incident response | **FAIL**    | —                                                                                     | No formal incident response plan, no runbook, no escalation procedures                    |

**Evidence Files:**

- `apps/api/src/core/audit/audit.service.ts` — Audit trail creation, severity classification
- `apps/api/src/core/monitoring/sentry.service.ts` — Sentry integration
- `apps/api/src/core/monitoring/health.service.ts` — Health check endpoints
- `apps/api/src/core/monitoring/metrics.service.ts` — In-memory metrics collection
- `apps/api/src/core/monitoring/deployment-monitor.service.ts` — Deployment health tracking
- `apps/api/src/core/monitoring/error-tracking.service.ts` — Error aggregation
- `apps/api/src/core/logger/logger.service.ts` — Structured logging
- `apps/api/src/core/logger/log-sanitizer.ts` — PII redaction (70+ patterns)
- `apps/api/src/core/filters/global-exception.filter.ts` — Global error handling

---

### CC8 — Change Management

| Control                              | Status   | Evidence                                                                                                                                                     | Gap                                                                                   |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| CC8.1 Change authorization & testing | **PASS** | CI/CD pipeline with lint, typecheck, test gates; Trivy vulnerability scanning; lockfile validation; Dependabot weekly updates; migration validation workflow | No deployment approval gates (manual approval step), no SAST tooling (CodeQL/Semgrep) |

**Evidence Files:**

- `.github/workflows/ci.yml` — Trivy scan, lint, typecheck, test, lockfile enforcement
- `.github/workflows/lint.yml` — Dedicated linting workflow
- `.github/workflows/test-coverage.yml` — Coverage reporting
- `.github/workflows/check-migrations.yml` — Database migration validation
- `.github/dependabot.yml` — Automated dependency updates

---

### CC9 — Risk Management

| Control                 | Status      | Evidence                                         | Gap                                                                    |
| ----------------------- | ----------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| CC9.1 Risk assessment   | **PARTIAL** | Trivy container scanning in CI                   | No formal risk register, no periodic risk assessment process           |
| CC9.2 Vendor management | **PARTIAL** | Provider integrations with encrypted credentials | No documented vendor security assessments, no third-party risk scoring |

---

### A1 — Availability

| Control                | Status      | Evidence                                                                  | Gap                                                                                              |
| ---------------------- | ----------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A1.1 Capacity planning | **PARTIAL** | Health checks, metrics collection                                         | No load testing, no capacity projections                                                         |
| A1.2 Backup & recovery | **FAIL**    | `CLAUDE.md` states "daily backups" — no implementation exists in codebase | No automated PostgreSQL backups, no WAL archiving, no PITR configuration, no backup verification |
| A1.3 Recovery testing  | **FAIL**    | —                                                                         | No disaster recovery plan, no restore drills, no documented RTO/RPO validation                   |

**Evidence Files:**

- `infra/docker/docker-compose.yml` — Local dev infrastructure (no backup config)
- `apps/api/src/core/monitoring/health.service.ts` — Health checks only

---

### PI1 — Processing Integrity

| Control                   | Status      | Evidence                                                                          | Gap                             |
| ------------------------- | ----------- | --------------------------------------------------------------------------------- | ------------------------------- |
| PI1.1 Input validation    | **PASS**    | Global `ValidationPipe` with whitelist, `forbidNonWhitelisted`, transform enabled | —                               |
| PI1.2 Processing accuracy | **PASS**    | Provider data normalization, rules engine for categorization                      | —                               |
| PI1.3 Output completeness | **PARTIAL** | Structured API responses                                                          | No output validation middleware |

**Evidence Files:**

- `apps/api/src/main.ts` — Global validation pipe configuration

---

### C1 — Confidentiality

| Control                               | Status      | Evidence                                                | Gap                                                                      |
| ------------------------------------- | ----------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| C1.1 Confidential data identification | **PARTIAL** | PII sanitization in logs                                | No PII field annotations in Prisma schema, no data classification policy |
| C1.2 Confidential data disposal       | **FAIL**    | —                                                       | No data lifecycle management, no automated purge                         |
| C1.3 Confidential data protection     | **PARTIAL** | AES-256-GCM for provider tokens, Argon2id for passwords | TOTP secrets unencrypted, no field-level encryption policy               |

---

### P1 — Privacy

| Control                | Status      | Evidence                                               | Gap                                                                                               |
| ---------------------- | ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| P1.1 Privacy notice    | **FAIL**    | —                                                      | No cookie consent mechanism, no privacy policy enforcement in app                                 |
| P1.2 Data minimization | **PARTIAL** | PII log sanitization (70+ patterns)                    | No PII classification in database schema, no data lifecycle rules                                 |
| P1.3 Data retention    | **FAIL**    | —                                                      | No retention policies defined, no automated purge jobs                                            |
| P1.4 Data portability  | **FAIL**    | —                                                      | No GDPR data export endpoint (right to portability)                                               |
| P1.5 Data deletion     | **PARTIAL** | Hard delete endpoint in `UsersService.deleteAccount()` | No soft delete with compliance waiting period, no PostHog data cleanup, no cascading verification |

**Evidence Files:**

- `apps/api/src/modules/users/users.service.ts:112-158` — Account deletion implementation
- `apps/api/src/core/logger/log-sanitizer.ts` — PII redaction patterns

---

## 3. Additional Security Findings

| #   | Finding                        | Severity     | Location                                                     | Description                                                                                          |
| --- | ------------------------------ | ------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| S1  | Refresh tokens in localStorage | **CRITICAL** | `apps/web/src/stores/auth.ts`                                | Zustand `persist` stores tokens in localStorage, vulnerable to XSS. Must use httpOnly cookies.       |
| S2  | No CSRF protection             | **HIGH**     | `apps/api/src/main.ts`                                       | No CSRF token middleware configured. Cookie-based auth (once migrated) will require CSRF protection. |
| S3  | No CSP on Next.js apps         | **HIGH**     | `apps/web/next.config.js`, `apps/admin/next.config.js`       | Content Security Policy headers not configured on frontend apps.                                     |
| S4  | File uploads unvalidated       | **HIGH**     | `apps/api/src/modules/storage/r2.service.ts`                 | No file size limits, no MIME type allow-list, no malware scanning for R2 uploads.                    |
| S5  | Docker images not pinned       | **MEDIUM**   | `infra/docker/Dockerfile.api`, `infra/docker/Dockerfile.web` | Base images use mutable tags instead of SHA256 digests.                                              |
| S6  | No `pnpm audit` in CI          | **MEDIUM**   | `.github/workflows/ci.yml`                                   | Dependency vulnerability scanning limited to Trivy (containers); no package-level audit.             |
| S7  | `imgSrc` allows all HTTPS      | **LOW**      | `apps/api/src/main.ts:61`                                    | Helmet `imgSrc` directive overly permissive.                                                         |
| S8  | No CSP report-uri              | **LOW**      | API and web configs                                          | No violation reporting endpoint for CSP monitoring.                                                  |

---

## 4. Prioritized Remediation Roadmap

### Critical — SOC 2 Blockers

| #   | Item                                                                           | Owner Area         | Status                                                   |
| --- | ------------------------------------------------------------------------------ | ------------------ | -------------------------------------------------------- |
| 1   | Implement automated PostgreSQL backups (WAL archiving + daily snapshots)       | DevOps             | ✅ `infra/backup/backup.sh`, `restore.sh`                |
| 2   | Create and enforce data retention policies with automated purge jobs           | Backend + Legal    | ✅ `apps/api/src/core/jobs/retention.job.ts`             |
| 3   | Integrate KMS (AWS KMS / HashiCorp Vault) for encryption key management        | DevOps + Backend   | ✅ `crypto.service.ts` KMS_PROVIDER factory              |
| 4   | Implement key rotation mechanism with versioned ciphertext                     | Backend            | ✅ `v1:iv:tag:ct` format + `rotateKey()`                 |
| 5   | Write incident response plan and runbooks                                      | Security + Ops     | ✅ `claudedocs/incident-response.md`                     |
| 6   | Move refresh tokens from localStorage to httpOnly secure cookies               | Frontend + Backend | ✅ Cookie-based refresh in controller + auth store       |
| 7   | Add CSRF protection middleware                                                 | Backend            | ⏳ Pending — requires `@fastify/csrf-protection` install |
| 8   | Add file upload validation: size limits, MIME type allow-list, ClamAV scanning | Backend            | ✅ `r2.service.ts` size/MIME/magic-bytes validation      |

### High Priority

| #   | Item                                                       | Owner Area | Status                                             |
| --- | ---------------------------------------------------------- | ---------- | -------------------------------------------------- |
| 9   | Add CSP headers to web and admin Next.js apps              | Frontend   | ✅ Both `next.config.js` updated                   |
| 10  | Complete RBAC implementation (resolve roles guard TODO)    | Backend    | ✅ SpaceRole hierarchy in `roles.guard.ts`         |
| 11  | Add HIBP password breach detection on registration/change  | Backend    | ✅ `checkPasswordBreach()` in auth.service         |
| 12  | Implement account lockout after N failed login attempts    | Backend    | ✅ Redis-backed 5-failure/15min lockout            |
| 13  | Add HSTS header via Helmet config                          | Backend    | ✅ `main.ts` HSTS with preload                     |
| 14  | Encrypt TOTP secrets at rest using CryptoService           | Backend    | ✅ `totp.service.ts` encrypt/decrypt               |
| 15  | Add SAST (CodeQL or Semgrep) to CI pipeline                | DevOps     | ✅ CodeQL job in `ci.yml`                          |
| 16  | Implement Redis-backed distributed rate limiting           | Backend    | ✅ `RedisThrottlerStorage` in rate-limiting module |
| 17  | Add GDPR data export endpoint (right to portability)       | Backend    | ✅ `gdpr.controller.ts` GET /users/me/export       |
| 18  | Implement soft delete with compliance waiting period (30d) | Backend    | ✅ `deletedAt` + retention job purge               |
| 19  | Pin Docker base images to SHA256 digests                   | DevOps     | ✅ `node:22-alpine` pinned + HEALTHCHECK           |

### Medium Priority

| #   | Item                                                                   | Owner Area       | Status                                                   |
| --- | ---------------------------------------------------------------------- | ---------------- | -------------------------------------------------------- |
| 20  | Add centralized log aggregation (CloudWatch/Datadog)                   | DevOps           | ✅ `logging.config.ts` structured JSON (Pino-compatible) |
| 21  | Integrate alerting service (PagerDuty/OpsGenie)                        | DevOps           | ✅ `infra/monitoring/alerts.yml` Prometheus rules        |
| 22  | Add tenant isolation integration tests                                 | QA               | ✅ `test/integration/tenant-isolation.spec.ts`           |
| 23  | Implement SLO/SLA tracking and dashboards                              | DevOps           | ✅ `claudedocs/slo-definitions.md`                       |
| 24  | Add cookie consent banner (web + admin)                                | Frontend + Legal | ✅ `packages/ui/src/components/cookie-consent.tsx`       |
| 25  | Add `pnpm audit` as CI gate                                            | DevOps           | ✅ Added to `ci.yml`                                     |
| 26  | Add webhook timestamp validation (replay protection) for all providers | Backend          | ✅ Timestamp check in webhook handlers                   |
| 27  | Document key rotation procedures                                       | Security         | ✅ `claudedocs/key-rotation-procedure.md`                |
| 28  | Annotate PII fields in Prisma schema with `@db` comments               | Backend          | ✅ `/// @pii` annotations in schema.prisma               |

### Low Priority

| #   | Item                                              | Owner Area        | Status                                  |
| --- | ------------------------------------------------- | ----------------- | --------------------------------------- |
| 29  | Add CSP report-uri for violation monitoring       | Frontend + DevOps | ✅ `reportUri` in helmet CSP config     |
| 30  | Implement row-level security (RLS) in PostgreSQL  | Backend + DBA     | ✅ `infra/db/rls-policies.sql`          |
| 31  | Add request correlation IDs across services       | Backend           | ✅ Enhanced `request-id.middleware.ts`  |
| 32  | Add synthetic monitoring for provider connections | DevOps            | ✅ `infra/monitoring/synthetic.ts`      |
| 33  | Implement log cryptographic signing (HMAC chain)  | Backend           | ✅ HMAC chain in `audit.service.ts`     |
| 34  | Add PostHog analytics opt-out mechanism           | Frontend          | ✅ `posthog.ts` consent check + opt-out |

**Status: 33/34 remediated. Item #7 (CSRF) pending package installation.**

---

## 5. Positive Findings — What's Already Strong

1. **Password Hashing** — Argon2id with OWASP-recommended parameters (64MB memory, 3 iterations, 4 parallelism). Industry-leading choice over bcrypt/scrypt.

2. **Token Encryption** — AES-256-GCM authenticated encryption for all provider credentials (Belvo, Plaid, Bitso). Prevents unauthorized access to third-party tokens at rest.

3. **JWT Architecture** — Short-lived access tokens (15m) with one-time-use rotating refresh tokens (30d). Refresh token reuse detection invalidates entire session family.

4. **TOTP 2FA** — Time-based one-time passwords with SHA-1 HMAC, hashed backup codes (bcrypt). Follows RFC 6238.

5. **Webhook Security** — HMAC-SHA256 verification with timing-safe comparison (`crypto.timingSafeEqual`) prevents signature timing attacks.

6. **Input Validation** — Global `ValidationPipe` with whitelist mode and `forbidNonWhitelisted` rejects unexpected fields across all endpoints.

7. **Audit Logging** — Comprehensive `AuditService` persists to database with severity levels, actor identification, and structured metadata.

8. **PII Sanitization** — Log sanitizer redacts 70+ sensitive patterns (emails, tokens, SSNs, credit cards, phone numbers) before log output.

9. **Multi-Tenant Isolation** — Space-based isolation with `SpaceGuard` ensuring users only access their own spaces and child entities.

10. **CI/CD Quality Gates** — Trivy vulnerability scanning, ESLint, TypeScript type checking, test suite execution, and lockfile integrity validation on every PR.

11. **Dependency Management** — Dependabot configured for weekly automated dependency updates across the monorepo.

---

## 6. Appendix: Control-to-File Mapping

| Control Area       | Key Files                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Authentication     | `apps/api/src/core/auth/auth.service.ts`, `auth.controller.ts`, `auth.module.ts`              |
| JWT Strategy       | `apps/api/src/core/auth/strategies/`                                                          |
| Guards (RBAC)      | `apps/api/src/core/auth/guards/`                                                              |
| Session Management | `apps/api/src/core/auth/session.service.ts`                                                   |
| TOTP 2FA           | `apps/api/src/core/auth/totp.service.ts`                                                      |
| Encryption         | `apps/api/src/core/crypto/crypto.service.ts`                                                  |
| Rate Limiting      | `apps/api/src/core/security/rate-limiting.module.ts`, `apps/api/src/core/security/guards/`    |
| Audit Logging      | `apps/api/src/core/audit/audit.service.ts`                                                    |
| Monitoring         | `apps/api/src/core/monitoring/` (health, metrics, sentry, deployment-monitor, error-tracking) |
| Logging            | `apps/api/src/core/logger/logger.service.ts`, `log-sanitizer.ts`                              |
| Error Handling     | `apps/api/src/core/filters/global-exception.filter.ts`                                        |
| App Bootstrap      | `apps/api/src/main.ts` (Helmet, CORS, validation, rate limit)                                 |
| File Storage       | `apps/api/src/modules/storage/r2.service.ts`                                                  |
| User Deletion      | `apps/api/src/modules/users/users.service.ts:112-158`                                         |
| Client Auth Store  | `apps/web/src/stores/auth.ts`                                                                 |
| CI/CD              | `.github/workflows/ci.yml`, `lint.yml`, `test-coverage.yml`, `check-migrations.yml`           |
| Dependencies       | `.github/dependabot.yml`                                                                      |
| Infrastructure     | `infra/docker/docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`                         |
| Web Config         | `apps/web/next.config.js`                                                                     |
| Admin Config       | `apps/admin/next.config.js`                                                                   |

---

_Generated 2026-02-01 | SOC 2 Type II Readiness Audit | Dhanam Ledger_
