# Dhanam Competitive Benchmarks

> **Landing UX:** Feature/pricing matrices below complement the full marketing-site
> remediation program in [../LANDING_REMEDIATION.md](../LANDING_REMEDIATION.md)
> (competitor landing patterns, Dhanam `dhan.am` execution plan, design system:
> [../LANDING_DESIGN_SYSTEM.md](../LANDING_DESIGN_SYSTEM.md)).

## Competitive Landscape

| Product          | Free       | Monthly | Annual          | What They Offer                          |
| ---------------- | ---------- | ------- | --------------- | ---------------------------------------- |
| Monarch Money    | No         | $14.99  | $99.99/yr       | Budgeting + investing, household sharing |
| YNAB             | No         | $14.99  | $109/yr         | Zero-based budgeting only                |
| Copilot Money    | No         | $13     | ~$95/yr         | Apple-only, premium design               |
| Lunch Money      | No         | $10     | $50-150/yr PWYW | Multi-currency, dev API                  |
| Quicken Simplifi | No         | $5.99   | $71.88/yr       | Budget option                            |
| Empower          | **YES**    | —       | 0.49-0.89% AUM  | Free dashboard → paid advisory funnel    |
| Kubera           | No         | —       | $249/yr         | Net worth + Life Beat (no budgeting)     |
| CoinStats        | Partial    | $13.99  | —               | 300+ wallet/exchange connections         |
| Delta (eToro)    | Partial    | $3.49   | $59.99/yr       | Multi-asset tracker                      |
| Firefly III      | OSS (AGPL) | —       | —               | Self-hosted budgeting                    |
| Actual Budget    | OSS (MIT)  | —       | —               | Local-first envelopes                    |

## Key Gap

No competitor combines budgeting + wealth + DeFi + ESG + collectibles + estate planning. No competitor serves Mexico with bank sync + budgeting + wealth tracking.

## Feature Comparison

| Feature                         | Dhanam  | Monarch | YNAB  | Kubera  | CoinStats | Firefly III |
| ------------------------------- | ------- | ------- | ----- | ------- | --------- | ----------- |
| Budgeting (zero-based)          | ✅      | ✅      | ✅    | ❌      | ❌        | ✅          |
| Net worth tracking              | ✅      | ✅      | ❌    | ✅      | Partial   | ❌          |
| MX bank sync (Belvo)            | ✅      | ❌      | ❌    | ❌      | ❌        | ❌          |
| US bank sync (Plaid)            | ✅      | ✅      | ✅    | ✅      | ❌        | ❌          |
| DeFi tracking (50+ protocols)   | ✅      | ❌      | ❌    | Partial | ✅        | ❌          |
| Crypto ESG scoring              | ✅      | ❌      | ❌    | ❌      | ❌        | ❌          |
| Collectibles (7 categories)     | ✅      | ❌      | ❌    | ❌      | ❌        | ❌          |
| Real estate (Zillow)            | ✅      | ❌      | ❌    | ✅      | ❌        | ❌          |
| Monte Carlo / retirement        | ✅      | ❌      | ❌    | ❌      | ❌        | ❌          |
| 12 stress test scenarios        | ✅      | ❌      | ❌    | ❌      | ❌        | ❌          |
| Estate planning / Life Beat     | ✅      | ❌      | ❌    | ✅      | ❌        | ❌          |
| AI categorization (ML loop)     | ✅      | Basic   | Basic | ❌      | ❌        | ❌          |
| Household views (Y/M/O)         | ✅      | Shared  | ❌    | ❌      | ❌        | ❌          |
| Open source                     | ✅ AGPL | ❌      | ❌    | ❌      | ❌        | ✅ AGPL     |
| LATAM native (ES, MXN, Banxico) | ✅      | ❌      | ❌    | ❌      | ❌        | ❌          |

## Infrastructure Cost Per Active User

| Component                          | Monthly Cost    |
| ---------------------------------- | --------------- |
| Compute (API/Worker)               | $0.05–0.15      |
| Database (PostgreSQL)              | $0.20–0.40      |
| External APIs (Belvo/Plaid/Zapper) | $0.10–0.50      |
| Storage (R2/backups)               | $0.02–0.10      |
| CDN/Edge                           | $0.02–0.05      |
| Infrastructure overhead            | $0.20–0.40      |
| **Total COGS/user/month**          | **$0.60–$1.65** |

Scaling: 100 DAU = 1 API instance, 1,000 DAU = 2-3 instances, 10,000 DAU = 8+ instances.

## Strategic Positioning

Dhanam delivers more than Monarch ($14.99) + Kubera ($249/yr) + CoinStats ($13.99) combined, at a lower price than any one of them. The open-source Community tier competes with Firefly III while adding ESG and basic simulations. The LATAM-first approach (Belvo, MXN, Banxico) has zero competition.

## Regional Strategy

- **MXN prices** at ~93% of direct FX conversion (subtle regional discount)
- **Conekta** for MXN payments (OXXO cash, SPEI, Mexican cards)
- **Stripe** for USD/international
- **Paddle** for EU VAT compliance (merchant of record)
- **Polar** for open-source community tips/sponsorships
- Future LATAM expansion (Brazil, Colombia): 40-60% PPP discounts via Stripe regional pricing

## Conversion Strategy

- **Community → Essentials**: Self-hosting friction + ML categorization as daily-use killer feature
- **Essentials → Pro**: Hit limits organically (3rd bank, DeFi, household, Life Beat after life event)
- **Pro → MADFAM One**: Cross-sell from Enclii/Janua users; bundle cheaper than buying separately
- **Annual target**: 40%+ annual subscriptions within 12 months
