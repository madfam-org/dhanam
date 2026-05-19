# ADR-001: NestJS with Fastify over Express

## Status

**Accepted** - January 2025

## Context

Dhanam is a financial management platform requiring:

- High-throughput API for real-time transaction processing
- Low-latency responses for dashboard data fetching
- Efficient handling of concurrent provider sync operations
- JSON-heavy payloads from financial data providers
- Strong TypeScript integration for type safety

The backend framework decision affects performance, developer experience, and long-term maintainability.

## Decision

Use **NestJS** as the application framework with **Fastify** as the HTTP adapter instead of the default Express.

### Why NestJS

1. **Modular Architecture**: NestJS's module system aligns perfectly with domain-driven design for financial modules (billing, providers, transactions, etc.)

2. **Dependency Injection**: Built-in DI container enables clean separation of concerns and testability (critical for financial services)

3. **TypeScript-First**: Native TypeScript support with decorators reduces runtime errors in financial calculations

4. **OpenAPI Integration**: `@nestjs/swagger` generates accurate API documentation automatically from decorators

5. **Guards and Interceptors**: Centralized authentication (Janua JWT) and logging patterns

### Why Fastify over Express

| Metric             | Express          | Fastify         | Benefit            |
| ------------------ | ---------------- | --------------- | ------------------ |
| JSON Serialization | 15,000 req/s     | 78,000 req/s    | 5x faster          |
| Payload Parsing    | Manual           | Schema-based    | Validation + speed |
| Routing            | Pattern matching | Radix tree      | O(1) lookups       |
| Async Support      | Callbacks        | Native promises | Cleaner code       |

**Performance Benchmarks** (internal testing with financial data payloads):

- Account sync: 40% faster response times
- Transaction batch processing: 3x throughput improvement
- Memory usage: 25% lower under load

### Additional Fastify Benefits

1. **Schema Validation**: JSON Schema validation at the router level catches malformed requests before business logic

2. **Plugin Ecosystem**: `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit` for security

3. **Logging**: Pino integration (10x faster than Winston) with structured JSON logs

4. **HTTP/2 Support**: Native HTTP/2 for future mobile app optimization

## Consequences

### Positive

- Significantly improved API performance for real-time financial dashboards
- Better developer experience with TypeScript and decorators
- Automatic OpenAPI documentation generation
- Future-proof architecture for scaling

### Negative

- Smaller ecosystem than Express (some middleware needs adaptation)
- Learning curve for developers unfamiliar with Fastify's plugin system
- Some NestJS examples default to Express (need Fastify-specific configuration)

### Mitigations

- Created `apps/api/src/main.ts` template with Fastify configuration
- Documented Fastify-specific patterns in module READMEs
- Established plugin compatibility checklist

## Related Decisions

- [ADR-002](./002-prisma-orm.md): Prisma ORM selection
- [ADR-004](./004-janua-auth-integration.md): Janua authentication integration

## References

- [Fastify Benchmarks](https://fastify.dev/benchmarks)
- [NestJS Fastify Adapter](https://docs.nestjs.com/techniques/performance)
- Internal performance testing report (Q4 2024)
