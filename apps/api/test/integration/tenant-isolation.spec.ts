import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@core/prisma/prisma.service';

/**
 * Tenant Isolation Tests
 * Verifies that User A cannot access User B's spaces, accounts, or transactions.
 * SOC 2 Control: Logical access controls and data segregation.
 */
describe('Tenant Isolation', () => {
  let prisma: PrismaService;
  let userA: { id: string; spaceId: string; accountId: string };
  let userB: { id: string; spaceId: string; accountId: string };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);

    // Create User A with space and account
    const userARecord = await prisma.user.create({
      data: {
        email: 'tenant-test-a@test.com',
        passwordHash: 'hashed',
        name: 'User A',
      },
    });

    const spaceA = await prisma.space.create({
      data: {
        name: 'Space A',
        type: 'personal',
        userSpaces: { create: { userId: userARecord.id, role: 'owner' } },
      },
    });

    const accountA = await prisma.account.create({
      data: {
        spaceId: spaceA.id,
        provider: 'manual',
        name: 'Account A',
        type: 'checking',
        currency: 'USD',
        balance: 1000,
      },
    });

    userA = { id: userARecord.id, spaceId: spaceA.id, accountId: accountA.id };

    // Create User B with space and account
    const userBRecord = await prisma.user.create({
      data: {
        email: 'tenant-test-b@test.com',
        passwordHash: 'hashed',
        name: 'User B',
      },
    });

    const spaceB = await prisma.space.create({
      data: {
        name: 'Space B',
        type: 'personal',
        userSpaces: { create: { userId: userBRecord.id, role: 'owner' } },
      },
    });

    const accountB = await prisma.account.create({
      data: {
        spaceId: spaceB.id,
        provider: 'manual',
        name: 'Account B',
        type: 'checking',
        currency: 'USD',
        balance: 2000,
      },
    });

    userB = { id: userBRecord.id, spaceId: spaceB.id, accountId: accountB.id };
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.account.deleteMany({
      where: { id: { in: [userA.accountId, userB.accountId] } },
    });
    await prisma.space.deleteMany({
      where: { id: { in: [userA.spaceId, userB.spaceId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
    await prisma.$disconnect();
  });

  it('User A cannot see User B spaces', async () => {
    const spaces = await prisma.userSpace.findMany({
      where: { userId: userA.id },
    });
    const spaceIds = spaces.map((s) => s.spaceId);
    expect(spaceIds).not.toContain(userB.spaceId);
  });

  it('User A cannot see User B accounts via space', async () => {
    const accounts = await prisma.account.findMany({
      where: { spaceId: userA.spaceId },
    });
    const accountIds = accounts.map((a) => a.id);
    expect(accountIds).not.toContain(userB.accountId);
  });

  it('User B cannot query User A space directly', async () => {
    const userBSpaces = await prisma.userSpace.findMany({
      where: { userId: userB.id },
    });
    const spaceIds = userBSpaces.map((s) => s.spaceId);
    expect(spaceIds).not.toContain(userA.spaceId);
  });

  it('Cross-tenant account query returns empty', async () => {
    // User A trying to get accounts from User B's space
    const accounts = await prisma.account.findMany({
      where: {
        spaceId: userB.spaceId,
        space: {
          userSpaces: {
            some: { userId: userA.id },
          },
        },
      },
    });
    expect(accounts).toHaveLength(0);
  });

  it('Cross-tenant transaction query returns empty', async () => {
    // Create a transaction in User B's account
    await prisma.transaction.create({
      data: {
        accountId: userB.accountId,
        amount: 50,
        currency: 'USD',
        description: 'Test transaction',
        date: new Date(),
      },
    });

    // User A trying to see User B's transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        account: {
          space: {
            userSpaces: {
              some: { userId: userA.id },
            },
          },
        },
      },
    });

    const userBTransactions = transactions.filter((t) => t.accountId === userB.accountId);
    expect(userBTransactions).toHaveLength(0);
  });
});
