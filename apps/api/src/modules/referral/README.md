# Referral Module

Last updated: 2026-05-22

Rewards-only referral integration for the MADFAM ecosystem. **Referral funnel
tracking (codes, lifecycle) lives in PhyndCRM.** Dhanam applies rewards and
manages ambassador tiers when PhyndCRM sends a signed conversion webhook.

## Related docs

- [Billing module](../billing/README.md) — Stripe extensions and credits
- [Billing SDK](../../../../packages/billing-sdk/README.md) — `DhanamReferralClient` (JWT)
- [Module index](../README.md)

## Features

- Receive `referral.converted` webhooks from PhyndCRM (HMAC)
- Create `ReferralReward` rows (subscription extension, credit grants)
- Apply pending rewards via BullMQ (`ReferralRewardJob`, every 15 minutes)
- Ambassador tiers: none → bronze → silver → gold → platinum

## Reward structure (on conversion)

| Recipient     | Reward                                             |
| ------------- | -------------------------------------------------- |
| Referrer      | 1 free month (subscription extension) + 50 credits |
| Referred user | 50 credits                                         |

## API endpoints

Prefix: `/v1/referral` (global API prefix).

| Method | Path          | Auth                                                    | Purpose                           |
| ------ | ------------- | ------------------------------------------------------- | --------------------------------- |
| `POST` | `/reward`     | HMAC (`X-PhyndCRM-Signature` or `X-Referral-Signature`) | PhyndCRM conversion webhook       |
| `GET`  | `/rewards`    | JWT                                                     | Authenticated user reward history |
| `GET`  | `/ambassador` | JWT                                                     | Ambassador profile and tier       |

## Jobs

| Job                 | Schedule     | Purpose                 |
| ------------------- | ------------ | ----------------------- |
| `ReferralRewardJob` | Every 15 min | Process pending rewards |

## Environment variables

| Variable                  | Required        | Description                                            |
| ------------------------- | --------------- | ------------------------------------------------------ |
| `REFERRAL_WEBHOOK_SECRET` | Yes for webhook | HMAC secret for PhyndCRM payloads                      |
| `BILLING_WEBHOOK_SECRET`  | Fallback        | Used if `REFERRAL_WEBHOOK_SECRET` unset during rollout |

Stripe credentials from the billing module are required for subscription
extension rewards.

## Primary files

| File                            | Role                                  |
| ------------------------------- | ------------------------------------- |
| `referral.controller.ts`        | REST endpoints                        |
| `referral.service.ts`           | Webhook handling, reward creation     |
| `referral-reward.service.ts`    | Reward application (Stripe + credits) |
| `ambassador.service.ts`         | Tier calculation                      |
| `guards/referral-hmac.guard.ts` | HMAC verification                     |
| `jobs/referral-reward.job.ts`   | Scheduled reward processing           |

## Prisma models

- `ReferralReward`
- `AmbassadorProfile`

Cross-service referral IDs reference PhyndCRM; Dhanam does not own code generation.
