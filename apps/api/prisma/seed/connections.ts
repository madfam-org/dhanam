import { PrismaClient, Provider, ConnectionStatus } from '../../generated/prisma';
import { subDays, subHours } from 'date-fns';
import { SeedContext } from './helpers';

export async function seedConnections(prisma: PrismaClient, ctx: SeedContext) {
  // 1. CONNECTIONS (one per key account)
  console.log('\n🔗 Creating provider connections...');

  const keyAccounts = await Promise.all([
    prisma.account.findFirst({
      where: { spaceId: ctx.mariaSpace.id, providerAccountId: 'maria-bbva-checking' },
    }),
    prisma.account.findFirst({
      where: { spaceId: ctx.mariaSpace.id, providerAccountId: 'maria-bitso' },
    }),
    prisma.account.findFirst({
      where: { spaceId: ctx.enterpriseSpace.id, providerAccountId: 'enterprise-chase' },
    }),
    prisma.account.findFirst({
      where: { spaceId: ctx.carlosBusiness.id, providerAccountId: 'business-main' },
    }),
    prisma.account.findFirst({
      where: { spaceId: ctx.diegoSpace.id, providerAccountId: 'diego-bitso' },
    }),
    prisma.account.findFirst({
      where: { spaceId: ctx.diegoSpace.id, providerAccountId: 'diego-defi-ethereum' },
    }),
  ]);

  const [mariaBanking, mariaCrypto, enterpriseChase, carlosBusiness, diegoBitso, diegoDefi] =
    keyAccounts;

  const connectionRows = keyAccounts
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .map((account) => {
      // Guest crypto connection → error state for failover demo
      if (account.id === mariaCrypto?.id) {
        return {
          accountId: account.id,
          status: ConnectionStatus.error,
          metadata: {
            lastSync: subDays(new Date(), 2).toISOString(),
            syncCount: 18,
            errorMessage: 'API key expired - re-authentication required',
            errorCode: 'AUTH_EXPIRED',
            lastErrorAt: new Date().toISOString(),
          },
        };
      }
      // Diego's Polygon DeFi → disconnected for failover demo
      if (account.id === diegoDefi?.id) {
        return {
          accountId: account.id,
          status: ConnectionStatus.disconnected,
          metadata: {
            lastSync: subDays(new Date(), 5).toISOString(),
            syncCount: 12,
            disconnectedReason: 'Zapper API rate limit exceeded',
            disconnectedAt: subDays(new Date(), 1).toISOString(),
          },
        };
      }
      return {
        accountId: account.id,
        status: ConnectionStatus.active,
        metadata: {
          lastSync: new Date().toISOString(),
          syncCount: Math.floor(Math.random() * 50) + 10,
        },
      };
    });

  for (const conn of connectionRows) {
    await prisma.connection.upsert({
      where: { accountId: conn.accountId },
      update: {},
      create: conn,
    });
  }

  console.log(`  ✓ Created ${connectionRows.length} connections`);

  // 2. CONNECTION ATTEMPTS (2 per space: 1 success + 1 failure)
  console.log('\n📡 Creating connection attempts...');

  const attemptSpaces = [
    { spaceId: ctx.mariaSpace.id, provider: Provider.belvo, institutionId: 'bbva_mx' },
    { spaceId: ctx.mariaSpace.id, provider: Provider.bitso, institutionId: 'bitso' },
    { spaceId: ctx.enterpriseSpace.id, provider: Provider.plaid, institutionId: 'ins_chase' },
    { spaceId: ctx.carlosBusiness.id, provider: Provider.belvo, institutionId: 'bbva_mx' },
    { spaceId: ctx.diegoSpace.id, provider: Provider.bitso, institutionId: 'bitso' },
    { spaceId: ctx.diegoSpace.id, provider: Provider.blockchain, institutionId: 'zapper_defi' },
  ];

  const attemptRows = attemptSpaces.flatMap(({ spaceId, provider, institutionId }) => [
    {
      spaceId,
      provider,
      institutionId,
      attemptType: 'sync',
      status: 'success',
      responseTimeMs: Math.floor(Math.random() * 2000) + 500,
      failoverUsed: false,
      attemptedAt: subHours(new Date(), Math.floor(Math.random() * 24)),
    },
    {
      spaceId,
      provider,
      institutionId,
      attemptType: 'sync',
      status: 'failure',
      errorCode: 'TIMEOUT',
      errorMessage: 'Provider response exceeded 30s timeout',
      responseTimeMs: 30000,
      failoverUsed: false,
      attemptedAt: subDays(new Date(), Math.floor(Math.random() * 7) + 1),
    },
  ]);

  await prisma.connectionAttempt.createMany({ data: attemptRows });
  console.log(`  ✓ Created ${attemptRows.length} connection attempts`);

  // 3. PROVIDER HEALTH STATUS
  console.log('\n💚 Creating provider health status...');

  await prisma.providerHealthStatus.createMany({
    data: [
      {
        provider: Provider.belvo,
        region: 'MX',
        status: 'healthy',
        errorRate: 0.8,
        avgResponseTimeMs: 1200,
        successfulCalls: 4580,
        failedCalls: 37,
        lastSuccessAt: subHours(new Date(), 1),
        lastFailureAt: subDays(new Date(), 2),
        lastError: 'Rate limit exceeded - retried successfully',
        circuitBreakerOpen: false,
        lastHealthCheckAt: new Date(),
        rateLimited: false,
      },
      {
        provider: Provider.plaid,
        region: 'US',
        status: 'healthy',
        errorRate: 0.2,
        avgResponseTimeMs: 800,
        successfulCalls: 8920,
        failedCalls: 18,
        lastSuccessAt: subHours(new Date(), 1),
        lastFailureAt: subDays(new Date(), 5),
        circuitBreakerOpen: false,
        lastHealthCheckAt: new Date(),
        rateLimited: false,
      },
      {
        provider: Provider.bitso,
        region: 'MX',
        status: 'healthy',
        errorRate: 1.5,
        avgResponseTimeMs: 950,
        successfulCalls: 3200,
        failedCalls: 49,
        lastSuccessAt: subHours(new Date(), 2),
        lastFailureAt: subDays(new Date(), 1),
        lastError: 'API maintenance window',
        circuitBreakerOpen: false,
        lastHealthCheckAt: new Date(),
        rateLimited: false,
      },
      {
        provider: Provider.blockchain,
        region: 'US',
        status: 'degraded',
        errorRate: 2.9,
        avgResponseTimeMs: 2100,
        successfulCalls: 1850,
        failedCalls: 55,
        lastSuccessAt: subHours(new Date(), 3),
        lastFailureAt: subHours(new Date(), 6),
        lastError: 'Ethereum RPC node timeout',
        circuitBreakerOpen: false,
        lastHealthCheckAt: new Date(),
        rateLimited: false,
      },
    ],
  });

  console.log('  ✓ Created 4 provider health statuses');

  // 4. INSTITUTION PROVIDER MAPPINGS
  console.log('\n🏦 Creating institution-provider mappings...');

  await prisma.institutionProviderMapping.createMany({
    data: [
      {
        institutionId: 'bbva_mx',
        institutionName: 'BBVA México',
        primaryProvider: Provider.belvo,
        backupProviders: [],
        region: 'MX',
      },
      {
        institutionId: 'banorte_mx',
        institutionName: 'Banorte',
        primaryProvider: Provider.belvo,
        backupProviders: [],
        region: 'MX',
      },
      {
        institutionId: 'santander_mx',
        institutionName: 'Santander México',
        primaryProvider: Provider.belvo,
        backupProviders: [],
        region: 'MX',
      },
      {
        institutionId: 'hsbc_mx',
        institutionName: 'HSBC México',
        primaryProvider: Provider.belvo,
        backupProviders: [],
        region: 'MX',
      },
      {
        institutionId: 'ins_chase',
        institutionName: 'Chase Bank',
        primaryProvider: Provider.plaid,
        backupProviders: [],
        region: 'US',
      },
      {
        institutionId: 'ins_bofa',
        institutionName: 'Bank of America',
        primaryProvider: Provider.plaid,
        backupProviders: [],
        region: 'US',
      },
      {
        institutionId: 'bitso',
        institutionName: 'Bitso',
        primaryProvider: Provider.bitso,
        backupProviders: [],
        region: 'MX',
      },
      {
        institutionId: 'zapper_defi',
        institutionName: 'DeFi (Zapper)',
        primaryProvider: Provider.blockchain,
        backupProviders: [],
        region: 'US',
      },
    ],
  });

  console.log('  ✓ Created 8 institution-provider mappings');
}
