# Janua Catalog Truth - 2026-06-04

Dhanam's active `catalog.yaml` now exposes Janua only as a self-hosted Open
Source offer. The removed `managed` and `enterprise` tiers were not supported by
current Janua product evidence:

- Janua README marks managed SaaS hosting as unavailable.
- Janua README marks enterprise support contracts as unavailable.
- Janua README warns against using Janua when uptime SLAs are required.

The active Open Source tier keeps evidence-backed features only:

- Self-hosted OAuth2/OIDC provider.
- RS256 JWT/JWKS support.
- SAML, MFA, passkeys, and RBAC primitives.
- SDKs and migration tooling.

Re-add managed or enterprise Janua tiers only after Janua repo docs and operator
evidence prove those offers are current, priced or intentionally custom-quoted,
and supported by Tulana campaign-claim evidence.
