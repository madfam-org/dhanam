# RFC-4D: Cross-Service Event Bus Evaluation

**Status:** Draft
**Date:** 2026-04-07
**Author:** Engineering Team
**Stakeholders:** Platform, Billing, Infrastructure, Security

## Summary

This document evaluates NATS JetStream, Redis Streams, and the Transactional Outbox pattern as options for reliable cross-service event delivery in the MADFAM ecosystem. The decision determines how Dhanam publishes billing and financial events to downstream services, and establishes the pattern that other MADFAM services will follow.

## Context

The MADFAM ecosystem requires reliable cross-service event delivery for:

- **Dhanam billing events** -- tier upgrades, subscription changes, payment confirmations -- consumed by Janua (entitlement sync), Cotiza (quote pricing adjustments), and the admin dashboard.
- **Webhook delivery coordination** -- Dhanam currently receives webhooks from Stripe, Plaid, Belvo, Bitso, MetaMap, and Cotiza, each with its own signature verification and idempotency handling (see `apps/api/src/core/utils/webhook.util.ts`).
- **KYC status change notifications** -- MetaMap verification results must propagate to billing (tier gating) and admin (compliance dashboard).
- **Financial transaction sync events** -- provider sync completions, account balance updates, and categorization changes that other services may need to react to.

### Current State

Services communicate via HTTP webhooks with HMAC-SHA256 signature verification. This pattern is implemented in two forms:

1. **Inbound webhooks from external providers** (Stripe, Plaid, Belvo, Bitso, MetaMap): Dhanam receives these via dedicated controller endpoints. Idempotency is handled via Redis-based deduplication in `webhook.util.ts` (24-hour TTL) or in-memory sets with bounded size (see `CotizaWebhookController`, capped at 10,000 entries).

2. **Cross-service webhooks within MADFAM**: Cotiza relays billing events to Dhanam via `POST /api/v1/webhooks/cotiza` with HMAC-SHA256 in the `x-cotiza-signature` header. This is a point-to-point integration with no built-in retry, no ordering guarantees, and no replay capability.

### Limitations of the Current Approach

| Limitation                                | Impact                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No automatic retry with backoff           | A single network failure drops the event permanently unless the sender implements custom retry logic                                                          |
| No ordering guarantees                    | Concurrent webhook deliveries can arrive out of order, causing state inconsistencies (e.g., `subscription.cancelled` processed before `subscription.created`) |
| No replay capability                      | If a consumer was down during delivery, the event is lost; there is no way to reprocess historical events                                                     |
| Fan-out requires sender changes           | Adding a new consumer requires the sender to add another HTTP call; the sender must know all consumers                                                        |
| In-memory dedup does not survive restarts | The `CotizaWebhookController` loses its deduplication set on process restart, allowing duplicate processing                                                   |
| No dead-letter handling                   | Failed webhook processing is logged to Sentry but there is no systematic retry queue or dead-letter mechanism                                                 |

### PravaraMES Reference Implementation

PravaraMES has implemented a Transactional Outbox pattern that provides a useful reference point. The implementation consists of:

- **`event_outbox` table** (`022_event_outbox.up.sql`): Stores events with `event_type`, `channel_namespace`, `payload` (JSONB), and a `delivered` boolean flag. Includes tenant isolation via row-level security.
- **`OutboxRepository`** (`outbox_repository.go`): Provides `InsertEvent`, `GetPendingEvents` (ordered by `created_at ASC`), `MarkDelivered`, and `PurgeOldEvents` (deletes delivered events older than N days).
- **`OutboxPublisher`** (`outbox_publisher.go`): Wraps the real-time Centrifugo publisher. Every `Publish()` call first delivers to Centrifugo (the real-time path), then persists to the outbox table on a best-effort basis. Outbox failures are logged but never block real-time delivery.
- **Webhook delivery tracking**: Separate `webhook_subscriptions` and `webhook_deliveries` tables with `pending/delivered/failed/dead` status enum, `attempt_count`, `next_retry_at`, and `last_error` fields.

The PravaraMES pattern is designed for a single-service context (MES events delivered to external webhook subscribers). It does not address cross-service pub/sub within the MADFAM ecosystem, but its outbox table design and delivery tracking schema are reusable patterns.

## Options

### Option A: NATS JetStream

NATS JetStream is a persistence layer built on top of NATS that provides streaming, at-least-once (and exactly-once) delivery, and durable consumers.

**Delivery guarantees:** At-least-once by default. Exactly-once is available via message deduplication windows and idempotent consumers. Messages are acknowledged per consumer; unacknowledged messages are redelivered with configurable backoff.

**Consumer groups:** JetStream supports durable consumers with queue groups. Multiple instances of the same service share a consumer group and each message is delivered to exactly one instance. Different services subscribe as separate consumers and each receives every message.

**Replay:** Consumers can replay from any point in the stream -- by sequence number, by timestamp, or from the beginning. This is particularly valuable for onboarding new consumers or reprocessing after a bug fix.

**Persistence:** Messages are persisted to disk with configurable retention (by time, by count, or by size). Supports file-based and in-memory storage backends. Replication across NATS server clusters (R1, R3, R5) for durability.

**Operational complexity:** Requires deploying and operating a NATS server cluster (minimum 3 nodes for production). NATS is not currently in the MADFAM infrastructure stack. Adds a new stateful service to monitor, upgrade, and back up. Requires familiarity with NATS administration, stream configuration, and consumer lifecycle management.

**Latency:** Sub-millisecond publish latency within the same datacenter. Consumer delivery latency is typically under 5ms for push-based consumers.

**Throughput:** NATS can sustain millions of messages per second on commodity hardware. JetStream persistence reduces this to hundreds of thousands per second depending on disk I/O and replication factor, which still exceeds MADFAM's foreseeable requirements by orders of magnitude.

**Ecosystem fit:** Go-native client library (aligns with PravaraMES). Node.js client (`nats.js`) is mature. No existing operational experience in the team. Would require infrastructure provisioning via Enclii and new monitoring dashboards.

### Option B: Redis Streams

Redis Streams is a log-based data structure built into Redis 5.0+ that provides append-only message storage with consumer group semantics.

**Delivery guarantees:** At-least-once delivery via consumer groups with explicit acknowledgment (`XACK`). Unacknowledged messages can be claimed by other consumers after a configurable timeout (`XCLAIM` / `XAUTOCLAIM`). No built-in exactly-once semantics, but idempotent consumers (using the stream entry ID as a deduplication key) achieve effectively-once processing.

**Consumer groups:** Native support via `XGROUP`. Multiple instances of a service share a consumer group; each message is delivered to one instance. Multiple consumer groups on the same stream enable fan-out to different services. The `XPENDING` command provides visibility into unacknowledged messages per consumer.

**Replay:** Consumers can read from any position in the stream by ID or use the special `0` ID to read from the beginning. New consumer groups can be created starting at any point in the stream's history. The `XRANGE` command enables arbitrary range queries for debugging or reprocessing.

**Persistence:** Redis Streams inherit Redis's persistence model: RDB snapshots and/or AOF logging. With `appendfsync always`, durability approaches that of a dedicated message broker, at the cost of write throughput. With the default `appendfsync everysec`, there is a theoretical window of up to 1 second of data loss on crash. For the event types under consideration (billing state changes, KYC notifications), this is acceptable because the source of truth remains the originating service's database.

**Operational complexity:** Redis 7 Alpine is already deployed in the MADFAM stack. Dhanam uses it on database index 3 (`madfam-redis-shared:6379/3`) for BullMQ job queues, rate limiting, webhook idempotency, feature flags, FX rate caching, and collectibles valuation caching. Adding Streams requires no new infrastructure -- only additional key namespaces on the existing instance. The team already has operational experience with Redis monitoring and administration.

**Latency:** Publish latency under 1ms. Consumer delivery depends on polling interval (with `XREADGROUP BLOCK`, the consumer blocks until a message arrives, providing near-real-time delivery with no polling overhead).

**Throughput:** A single Redis instance can handle approximately 100,000-200,000 stream operations per second. MADFAM's cross-service event volume is unlikely to exceed a few hundred events per second at 10x current scale, leaving substantial headroom.

**Ecosystem fit:** `ioredis` (v5.9.3) is already a dependency in `apps/api/package.json`. The `RedisService` and `RedisModule` are established patterns in the Dhanam codebase (`apps/api/src/core/redis/`). BullMQ already uses Redis Streams internally for its job queue implementation. Adding cross-service event streams is an incremental extension of existing infrastructure and code patterns.

### Option C: Transactional Outbox + Polling Publisher

This option adapts the PravaraMES outbox pattern for cross-service communication. Events are written to an `event_outbox` table in the same database transaction as the business operation, then a background poller reads pending events and publishes them to consumers.

**Delivery guarantees:** At-least-once, with strong consistency between business state and event publication (the event is committed in the same transaction as the state change). This is the strongest consistency guarantee of the three options.

**Consumer groups:** Not natively supported. The outbox pattern is a publisher-side concern. Consumer fan-out and group semantics must be built on top, either by dispatching to multiple HTTP endpoints (the current webhook approach) or by feeding the outbox into a message broker (combining Option C with Option A or B).

**Replay:** Events are stored in PostgreSQL with full query capability. Replay is straightforward via SQL queries filtered by event type, timestamp, or entity ID. The PravaraMES implementation includes `ListEvents` with filtering, `GetEventsByEntityFromPayload`, and `GetEventTypes` for discovery.

**Persistence:** PostgreSQL-backed, with the same durability guarantees as the application's primary data store. The PravaraMES implementation includes `PurgeOldEvents` to manage table growth (deletes delivered events older than a configurable threshold).

**Operational complexity:** No new infrastructure. Uses the existing PostgreSQL database. However, the polling publisher introduces latency proportional to the poll interval, and high-frequency polling creates database load. The PravaraMES implementation polls for undelivered events ordered by `created_at ASC` with a configurable limit, but this pattern does not scale well beyond a few thousand events per minute without careful index tuning.

**Latency:** Bounded by the poll interval. A 1-second poll interval means up to 1 second of latency between event creation and consumer notification. Reducing the interval increases database load. For comparison, Redis Streams and NATS JetStream deliver sub-millisecond latency.

**Throughput:** Limited by database write throughput for inserts and polling query performance for reads. The PravaraMES outbox table uses a partial index on `(delivered, created_at) WHERE delivered = FALSE` to optimize the pending events query, but this is still a PostgreSQL query per poll cycle.

**Ecosystem fit:** PostgreSQL and the repository pattern are well-established in both PravaraMES (Go) and Dhanam (Prisma). The outbox table schema from PravaraMES can be adapted for Dhanam with minimal changes. However, the outbox pattern alone does not solve the consumer-side problems (fan-out, consumer groups, backpressure) -- it only guarantees reliable publication.

## Comparison Matrix

| Criterion                   | NATS JetStream                                              | Redis Streams                                                              | Transactional Outbox                                                                                     |
| --------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Durability**              | Strong (replicated disk persistence, configurable R-factor) | Moderate (AOF with `everysec` default; up to 1s data loss window on crash) | Strong (same-transaction commit with PostgreSQL)                                                         |
| **Ordering**                | Per-subject ordering guaranteed                             | Per-stream ordering guaranteed                                             | Per-table ordering by `created_at` (requires single-writer or sequence)                                  |
| **Replay**                  | Full replay by sequence, timestamp, or from beginning       | Full replay by stream ID or `XRANGE`                                       | Full replay via SQL queries                                                                              |
| **Consumer groups**         | Native (durable consumers + queue groups)                   | Native (`XGROUP` + `XREADGROUP`)                                           | Not supported (must build or combine with broker)                                                        |
| **Fan-out**                 | Multiple consumers per stream, each sees all messages       | Multiple consumer groups per stream                                        | Requires per-consumer delivery logic                                                                     |
| **Dead-letter handling**    | Built-in max delivery attempts with advisory messages       | Manual via `XPENDING` + `XCLAIM` + application logic                       | Manual via `status` column and retry scheduling (PravaraMES has `webhook_deliveries` with `dead` status) |
| **Operational overhead**    | High (new infrastructure component, cluster management)     | Low (extends existing Redis instance)                                      | Low (extends existing PostgreSQL, but polling adds DB load)                                              |
| **Latency**                 | Sub-millisecond                                             | Sub-millisecond (with `BLOCK` reads)                                       | Poll-interval-bounded (100ms-1s typical)                                                                 |
| **Throughput ceiling**      | Hundreds of thousands msg/s (disk-bound)                    | 100K-200K ops/s per instance                                               | Thousands msg/s (PostgreSQL-bound)                                                                       |
| **Existing infra reuse**    | None (new deployment required)                              | Full (Redis 7 already in stack, `ioredis` in deps)                         | Full (PostgreSQL already in stack, Prisma in deps)                                                       |
| **Client library maturity** | Mature (`nats.js` for Node, native Go)                      | Mature (`ioredis` already in use)                                          | Custom (repository pattern, proven in PravaraMES)                                                        |
| **Monitoring**              | Requires new dashboards (NATS-specific metrics)             | Existing Redis monitoring + `XINFO` commands                               | Existing PostgreSQL monitoring + custom outbox metrics                                                   |
| **Multi-language support**  | Excellent (Go, Node, Python, Rust, Java, .NET)              | Excellent (every Redis client supports Streams)                            | Per-language ORM/repository implementation required                                                      |

## Recommendation

**Use Redis Streams for cross-service event delivery, combined with a lightweight outbox pattern for transactional consistency at the publisher side.**

### Rationale

1. **Zero infrastructure addition.** Redis 7 is already deployed as `madfam-redis-shared` and used by Dhanam (DB index 3), PravaraMES, and other MADFAM services. `ioredis` is already a production dependency. The `RedisService` and `RedisModule` patterns are established. Adding Streams is a code change, not an infrastructure change.

2. **Consumer group semantics solve the fan-out problem.** The current webhook approach requires the sender (Cotiza, Dhanam) to know every consumer and maintain per-consumer HTTP delivery logic. With Redis Streams, Dhanam publishes to a stream (e.g., `madfam:events:billing`), and each consuming service creates its own consumer group. Adding a new consumer requires no changes to the publisher.

3. **Ordering and replay address current gaps.** Redis Streams guarantee per-stream ordering and support replay from any point. This eliminates the race conditions possible with concurrent webhook delivery and enables new services to bootstrap by replaying historical events.

4. **Sufficient durability for the event types in scope.** Billing state changes, KYC notifications, and subscription events have their source of truth in PostgreSQL. The Redis Stream serves as the distribution mechanism, not the system of record. A 1-second AOF durability window is acceptable because any lost events can be reconstructed from the source database if needed.

5. **BullMQ precedent.** Dhanam already uses BullMQ for background job processing, and BullMQ uses Redis Streams internally. The team has operational experience with Redis-backed queue semantics, stream backpressure, and failure recovery.

6. **NATS JetStream is overkill for current scale.** MADFAM's cross-service event volume is low (hundreds of events per day, not per second). Introducing a new stateful clustered service adds operational burden disproportionate to the reliability gains. JetStream's advantages -- multi-subject filtering, exactly-once semantics, cross-datacenter replication -- become relevant at scales and topologies MADFAM has not reached.

### Hybrid approach: Outbox + Redis Streams

For events where transactional consistency with the business operation is critical (e.g., a subscription tier change must be atomically committed with the billing record update), use a lightweight outbox table:

1. The business operation and the outbox insert happen in the same PostgreSQL transaction.
2. A background publisher (running on a short interval or triggered by PostgreSQL `LISTEN/NOTIFY`) reads pending outbox rows and publishes them to the appropriate Redis Stream.
3. Once the Redis `XADD` succeeds, the outbox row is marked as delivered.

This combines the transactional consistency of Option C with the consumer-side capabilities of Option B, without requiring NATS infrastructure.

### When to reconsider NATS JetStream

Migrate to NATS JetStream if any of the following conditions emerge:

- **Cross-datacenter event delivery.** If MADFAM deploys to multiple regions and needs events replicated across datacenters, NATS clustering provides this natively; Redis does not.
- **Event volume exceeds Redis capacity.** If cross-service event volume grows beyond what a single Redis instance can handle (unlikely before millions of events per day), NATS provides horizontal scaling.
- **Subject-based filtering becomes essential.** If consumers need fine-grained subscription patterns (e.g., `billing.subscription.*.mx` for Mexico-only subscription events), NATS's subject hierarchy is more expressive than Redis Stream key naming.
- **Exactly-once processing is required.** If downstream side effects are non-idempotent and cannot be made idempotent, NATS JetStream's exactly-once semantics provide stronger guarantees than Redis Streams' at-least-once model.
- **Multiple MADFAM services adopt Go.** NATS is Go-native and its operational tooling is Go-centric. If the ecosystem shifts toward Go services (PravaraMES already uses Go), the operational burden of NATS decreases.

## Migration Path

### Phase 1: Infrastructure and Library (Week 1)

Create a shared `EventBusModule` in Dhanam's core layer (`apps/api/src/core/event-bus/`) that wraps Redis Streams operations:

```
core/event-bus/
  event-bus.module.ts       # NestJS module, imports RedisModule
  event-bus.publisher.ts    # XADD wrapper with serialization and stream key conventions
  event-bus.consumer.ts     # XREADGROUP wrapper with consumer group lifecycle
  event-bus.types.ts        # Event envelope schema (id, type, timestamp, source, data)
  event-bus.constants.ts    # Stream names, consumer group names, retention policies
```

Define a standard event envelope that all MADFAM services use:

```typescript
interface MadfamEvent<T = unknown> {
  id: string; // UUID v4
  type: string; // dot-separated, e.g., "billing.subscription.upgraded"
  source: string; // originating service, e.g., "dhanam", "cotiza", "pravara-mes"
  timestamp: string; // ISO 8601
  version: number; // schema version for forward compatibility
  tenant_id?: string; // optional, for tenant-scoped events
  correlation_id?: string; // optional, for request tracing
  data: T; // event-specific payload
}
```

Configure stream retention via `XTRIM` with `MAXLEN ~` (approximate trimming) set to retain 7 days of events or 100,000 entries per stream, whichever is reached first.

### Phase 2: Publisher-Side Migration (Week 2)

Add an outbox table to Dhanam's Prisma schema:

```prisma
model EventOutbox {
  id          String   @id @default(uuid())
  eventType   String   @map("event_type")
  streamKey   String   @map("stream_key")
  payload     Json
  delivered   Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([delivered, createdAt], name: "idx_outbox_pending")
  @@index([eventType, createdAt], name: "idx_outbox_type_time")
  @@map("event_outbox")
}
```

Implement a `OutboxPublisher` that:

1. Inserts events into `EventOutbox` within the same Prisma transaction as the business operation.
2. Runs a background job (BullMQ, 1-second interval) that reads pending outbox rows, publishes to Redis Streams via `XADD`, and marks rows as delivered.
3. Purges delivered rows older than 30 days via a daily scheduled job.

### Phase 3: Consumer-Side Migration -- Cotiza (Week 3)

Replace the `CotizaWebhookController` (inbound) and the Cotiza `DhanamRelayService` (outbound) with Redis Streams consumption:

1. Cotiza publishes billing events to `madfam:events:billing` instead of calling `POST /api/v1/webhooks/cotiza`.
2. Dhanam creates a consumer group `dhanam-billing` on `madfam:events:billing` and processes events via the `EventBusConsumer`.
3. The existing `CotizaWebhookController` remains active during migration (dual-read) until all events are confirmed flowing through Redis Streams.
4. Remove the webhook endpoint after a 2-week observation period with zero webhook traffic.

### Phase 4: Publish Dhanam Events (Week 4)

Dhanam begins publishing its own events to Redis Streams:

- `madfam:events:billing` -- subscription changes, payment events, tier upgrades
- `madfam:events:kyc` -- KYC status changes from MetaMap
- `madfam:events:sync` -- provider sync completions, account updates

Other MADFAM services (Janua for entitlement sync, admin dashboard for real-time updates) create their own consumer groups on these streams.

### Phase 5: Deprecate Webhook-Based Cross-Service Communication (Week 6+)

- Remove point-to-point webhook integrations between MADFAM services.
- Retain inbound webhook endpoints for external providers (Stripe, Plaid, Belvo, Bitso, MetaMap) -- these cannot be replaced with Redis Streams because the providers control the delivery mechanism.
- Document the event catalog (all event types, their schemas, and their streams) in `docs/architecture/event-catalog.md`.

## Risks and Mitigations

| Risk                                                                    | Likelihood | Impact | Mitigation                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis instance failure loses in-flight events                           | Low        | Medium | Outbox table is the source of truth; the publisher retries on next poll cycle. Enable AOF with `appendfsync everysec`.                                                                               |
| Consumer falls behind and stream grows unbounded                        | Low        | Medium | Configure `MAXLEN ~100000` per stream. Monitor `XINFO GROUPS` for consumer lag. Alert on lag exceeding 1,000 entries.                                                                                |
| Schema evolution breaks consumers                                       | Medium     | High   | Version field in event envelope. Consumers ignore unknown versions. Publish schema changes as new event types rather than modifying existing ones.                                                   |
| Redis Streams `MAXLEN` trims events before slow consumer processes them | Low        | High   | Set retention generously (7 days / 100K entries). Monitor `XPENDING` for oldest unacknowledged message age. If a consumer needs historical replay beyond retention, query the outbox table directly. |
| Shared Redis instance becomes a bottleneck                              | Low        | Low    | MADFAM event volume is far below Redis capacity. If needed, move event streams to a dedicated Redis instance (configuration change, not architectural change).                                       |

## Related Documents

- [RFC: Belvo Payments Evaluation](./belvo-payments-evaluation.md)
- [PravaraMES Outbox Migration](../../../pravara-mes/apps/pravara-api/internal/db/migrations/022_event_outbox.up.sql) (reference implementation)
- [Dhanam Webhook Utility](../../apps/api/src/core/utils/webhook.util.ts) (current webhook handling)
- [Cotiza Webhook Controller](../../apps/api/src/modules/billing/cotiza-webhook.controller.ts) (current cross-service integration)
