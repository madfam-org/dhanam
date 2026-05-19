# ADR-002: Prisma ORM for Database Access

## Status

**Accepted** - January 2025

## Context

Dhanam requires a robust database access layer for:

- Complex financial data models (transactions, accounts, valuations, ESG scores)
- Type-safe queries to prevent financial calculation errors
- Migration management across development and production
- Multi-tenant data isolation (spaces/users)
- Efficient bulk operations for transaction sync (100+ records/batch)

Options considered:

1. **Raw SQL**: Maximum control, no abstraction overhead
2. **TypeORM**: Popular, decorator-based, Active Record + Data Mapper
3. **Prisma**: Schema-first, generated client, excellent TypeScript support
4. **Knex.js**: Query builder, no ORM overhead
5. **Drizzle**: New, TypeScript-native, good performance

## Decision

Use **Prisma** as the primary ORM with PostgreSQL.

### Why Prisma

1. **Schema as Source of Truth**

   ```prisma
   model Transaction {
     id        String   @id @default(cuid())
     amount    Decimal  @db.Decimal(19, 4)  // Financial precision
     accountId String
     account   Account  @relation(fields: [accountId], references: [id])
     @@index([accountId, date])
   }
   ```

   - Single schema file defines models, relations, and indexes
   - Generates TypeScript types automatically
   - Schema changes tracked in version control

2. **Type-Safe Client**

   ```typescript
   // Full autocomplete and type checking
   const transactions = await prisma.transaction.findMany({
     where: { account: { spaceId } },
     include: { category: true },
     orderBy: { date: 'desc' },
   });
   // transactions is fully typed with category relation
   ```

3. **Migration System**
   - `prisma migrate dev` for development
   - `prisma migrate deploy` for production
   - Migration history tracked in `prisma/migrations/`
   - Rollback via new migration (not destructive)

4. **Performance Features**
   - Connection pooling built-in
   - Batch operations: `createMany`, `updateMany`
   - Lazy relations to prevent N+1

5. **Financial Data Support**
   - `Decimal` type with configurable precision (19,4 for currency)
   - `DateTime` with timezone awareness
   - `Json` for flexible metadata (ML confidence, provider data)

### Comparison Matrix

| Feature        | Prisma      | TypeORM    | Drizzle   | Knex     |
| -------------- | ----------- | ---------- | --------- | -------- |
| Type Safety    | Excellent   | Good       | Excellent | Limited  |
| Migrations     | Built-in    | Built-in   | Built-in  | Built-in |
| Relations      | Declarative | Decorators | Manual    | Manual   |
| Raw SQL        | Supported   | Supported  | Native    | Native   |
| Learning Curve | Low         | Medium     | Low       | Low      |
| Community      | Large       | Large      | Growing   | Large    |

## Consequences

### Positive

- Zero-cost type safety for all database operations
- Reduced risk of SQL injection via parameterized queries
- Clear schema documentation in `schema.prisma`
- Excellent IDE support (Prisma VS Code extension)
- Built-in introspection for existing databases

### Negative

- Generated client adds build step
- Some complex queries require raw SQL (`$queryRaw`)
- Connection pooling configuration needed for serverless
- Schema changes require migration (no implicit sync)

### Mitigations

- `PrismaService` wrapper for lifecycle management in NestJS
- Raw SQL utilities for complex analytical queries
- Connection pooling via PgBouncer for high-load scenarios
- CI/CD pipeline validates migrations before deploy

## Implementation Details

### NestJS Integration

```typescript
// apps/api/src/core/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

### Financial Precision

```prisma
// All monetary values use Decimal(19, 4)
model Account {
  balance      Decimal @db.Decimal(19, 4)
  creditLimit  Decimal? @db.Decimal(19, 4)
}
```

### Multi-Tenant Queries

```typescript
// Always include spaceId in queries for data isolation
await prisma.transaction.findMany({
  where: { account: { spaceId: user.activeSpaceId } },
});
```

## Related Decisions

- [ADR-001](./001-nestjs-fastify.md): NestJS framework selection
- [ADR-003](./003-multi-provider-strategy.md): Provider data normalization

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- `packages/db/prisma/schema.prisma` - Current schema
