# Golden product webhook probes (WS3)

Offline and staging probes that lock the Dhanam → MADFAM product webhook contract.

## CI (always runs)

After every staging deploy, CI runs:

```bash
node scripts/golden-probes/verify-product-webhook-envelope.mjs
```

This validates the `payment.succeeded` envelope shape and HMAC signing contract
without calling live product endpoints.

Unit tests in
`apps/api/src/modules/billing/__tests__/golden-product-webhook-probe.spec.ts`
cover the same contract in Jest.

## Staging live probes (operator)

| Product  | Script                                                                          | Verify               |
| -------- | ------------------------------------------------------------------------------- | -------------------- |
| Karafiel | Run staging commercial smoke with charge tier + inspect timeline for `cfdiUuid` | CFDI correlation     |
| Cotiza   | Stripe MX envelope with `ecosystem.milestone_id` metadata                       | Quote status webhook |
| PhyndCRM | Envelope with `ecosystem.engagement_id`                                         | Engagement timeline  |
| Tezca    | Catalog checkout + product webhook delivery                                     | Tier webhook         |

Record execution in [COMMERCIAL_DLQ_DRILL.md](../docs/runbooks/COMMERCIAL_DLQ_DRILL.md)
and the G2 checklist in [COMMERCIAL_GA_EXECUTION.md](../docs/COMMERCIAL_GA_EXECUTION.md).
