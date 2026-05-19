# Dhanam Pricing Tiers

## Pricing Summary

|                     | Community        | Essentials | Pro                     | MADFAM One  |
| ------------------- | ---------------- | ---------- | ----------------------- | ----------- |
| **USD/mo**          | Free (self-host) | $4.99      | **$11.99 ★ Best Value** | Coming Soon |
| **USD/yr**          | —                | $49.99     | **$119.99 ★**           | TBD         |
| **MXN/mo**          | Free (self-host) | $79        | **$199 ★**              | Coming Soon |
| **MXN/yr**          | —                | $799       | **$1,999 ★**            | TBD         |
| **Annual discount** | —                | 17%        | 17%                     | —           |

---

## Tier 0: Community (Free, Self-Hosted)

The full AGPLv3 codebase on user's own infrastructure. All features are unlimited — the cloud moat is operational convenience (managed API keys, hosted storage, ML inference, support SLA), not feature lockdown.

| Feature                            | Included                           |
| ---------------------------------- | ---------------------------------- |
| Budgeting, transactions, net worth | ✅                                 |
| Manual account entry (unlimited)   | ✅                                 |
| Spaces                             | Unlimited                          |
| Blockchain address tracking        | ✅ (read-only)                     |
| ESG scoring                        | ✅ Unlimited (open-source package) |
| Monte Carlo                        | 10K iterations, 12 scenarios       |
| Localization (EN/ES/PT-BR)         | ✅                                 |
| Provider bank sync (Belvo/Plaid)   | ✅ BYOK (bring your own API keys)  |
| AI/ML categorization               | ✅ (self-hosted inference)         |
| Life Beat / Estate                 | ✅ (self-managed SMTP)             |
| Household views                    | ✅                                 |
| Collectibles valuation             | ✅ (BYOK for valuation APIs)       |
| Document storage                   | Unlimited (own disk/S3)            |
| Support                            | Community (GitHub/Discord)         |

**Provider API policy**: Self-hosters bring their own Belvo/Plaid/Bitso API keys via environment variables. All features and limits are unlimited since users provide their own infrastructure.

---

## Tier 1: Essentials — $4.99/mo | $49.99/yr | MXN $79/mo | $799/yr

Cloud-hosted on Enclii. Zero setup.

| Feature                              | Included                   |
| ------------------------------------ | -------------------------- |
| Everything in Community              | ✅                         |
| Belvo bank sync (2 institutions)     | ✅                         |
| Bitso connection (1 account)         | ✅                         |
| AI categorization (ML learning loop) | ✅                         |
| Recurring transaction detection      | ✅                         |
| 60-day cashflow forecast             | ✅                         |
| Monte Carlo                          | 5K iterations, 6 scenarios |
| 10-year projections                  | ✅                         |
| Spaces                               | 2 (personal + 1 business)  |
| Document storage                     | 500 MB                     |
| TOTP 2FA                             | ✅                         |
| Support                              | Email (48hr SLA)           |

**Gross margin**: 80–88%.

---

## Tier 2: Pro — $11.99/mo | $119.99/yr | MXN $199/mo | $1,999/yr

The full platform. Everything unlocked.

| Feature                                     | Included                         |
| ------------------------------------------- | -------------------------------- |
| Everything in Essentials                    | ✅                               |
| Unlimited provider connections (all 7)      | ✅                               |
| Zapper DeFi (7 chains, 50+ protocols)       | ✅                               |
| Zillow real estate valuation                | ✅                               |
| Collectibles valuation (7 adapters)         | ✅                               |
| Full AI/ML (all 5 strategies)               | ✅                               |
| Monte Carlo                                 | 10K iterations, all 12 scenarios |
| 30-year projections + retirement planning   | ✅                               |
| Goal probability analysis                   | ✅                               |
| Household views (Yours/Mine/Ours)           | ✅                               |
| Life Beat + digital wills + executor access | ✅                               |
| Spaces                                      | 5                                |
| Document storage                            | 5 GB                             |
| Support                                     | Priority (24hr SLA)              |

**Gross margin**: 86–90%.

---

## Tier 3: MADFAM One (Ecosystem) — Coming Soon

Dhanam Pro + the entire MADFAM ecosystem. Pricing TBD.

| Feature                                   | Planned              |
| ----------------------------------------- | -------------------- |
| Everything in Pro                         | ✅                   |
| Janua SSO (custom domain, unlimited apps) | ✅                   |
| Enclii deployment credits                 | ✅                   |
| Future MADFAM products at launch          | ✅                   |
| Spaces                                    | 10                   |
| Document storage                          | 25 GB                |
| API access (rate-limited)                 | ✅                   |
| Early access / beta programs              | ✅                   |
| Support                                   | Dedicated (12hr SLA) |

**Status**: Coming Soon — "Join waitlist" CTA on pricing page.

---

## Pricing Page Design Notes

- **Pro as "Best Value"**: Visually highlight with badge/ribbon, larger card, or contrasting color
- **MADFAM One as "Coming Soon"**: Greyed-out or muted card with waitlist CTA, no price shown
- **Annual toggle**: Show monthly prices by default, annual with "Save 17%" badge
- **MXN/USD toggle**: Auto-detect from locale, allow manual switch
