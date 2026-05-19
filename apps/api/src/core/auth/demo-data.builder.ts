import { Logger } from '@nestjs/common';
import { startOfMonth, endOfMonth } from 'date-fns';

import { Currency, SpaceType, BudgetPeriod, Provider, User } from '@db';

import { PrismaService } from '../prisma/prisma.service';

import { AnalyticsBuilder } from './demo-data/analytics.builder';
import { AssetsBuilder } from './demo-data/assets.builder';
import { CashflowBuilder } from './demo-data/cashflow.builder';
import { ConnectionsBuilder } from './demo-data/connections.builder';
import { ESGBuilder } from './demo-data/esg.builder';
import { EstateBuilder } from './demo-data/estate.builder';
import { GoalsBuilder } from './demo-data/goals.builder';
import { HouseholdBuilder } from './demo-data/household.builder';
import { NotificationsBuilder } from './demo-data/notifications.builder';
import { RecurringBuilder } from './demo-data/recurring.builder';
import { ReportsBuilder } from './demo-data/reports.builder';
import { RulesBuilder } from './demo-data/rules.builder';
import { SimulationsBuilder } from './demo-data/simulations.builder';
import { TransactionsBuilder } from './demo-data/transactions.builder';
import { DemoContext } from './demo-data/types';
import { ZeroBasedBuilder } from './demo-data/zero-based.builder';

interface GeoDefaults {
  locale: string;
  timezone: string;
  currency: string;
}

/**
 * Builds demo persona data at runtime when seed hasn't been run.
 * Each builder method is idempotent — skips creation if the user already has accounts.
 * After base user/space/account/budget creation, runs enrichment pipeline
 * to fill transactions, goals, assets, ESG scores, estate planning, etc.
 */
export class DemoDataBuilder {
  private readonly logger = new Logger(DemoDataBuilder.name);
  constructor(private prisma: PrismaService) {}

  async buildPersona(personaKey: string, geo: GeoDefaults): Promise<User> {
    const builders: Record<string, () => Promise<User>> = {
      guest: () => this.buildGuestPersona(geo),
      maria: () => this.buildMariaPersona(geo),
      carlos: () => this.buildCarlosPersona(geo),
      patricia: () => this.buildPatriciaPersona(geo),
      diego: () => this.buildDiegoPersona(geo),
    };

    const ALLOWED_PERSONAS = ['guest', 'maria', 'carlos', 'patricia', 'diego'] as const;
    if (!ALLOWED_PERSONAS.includes(personaKey as any)) {
      throw new Error('Unknown persona');
    }
    const builder = builders[personaKey];

    const user = await builder();

    // Run enrichment pipeline (idempotent — skips if transactions already exist)
    await this.enrichPersona(user, personaKey);

    return user;
  }

  /**
   * Enrichment pipeline: generates transactions, valuations, goals, assets, ESG,
   * estate planning, recurring patterns, connections, reports, and notifications.
   * Idempotent: checks transaction count before running.
   * Fault-tolerant: individual builder failures are logged but don't crash the login.
   */
  private async enrichPersona(user: User, personaKey: string): Promise<void> {
    const txnCount = await this.prisma.transaction.count({
      where: { account: { space: { userSpaces: { some: { userId: user.id } } } } },
    });
    if (txnCount > 0) return;

    const ctx = await this.buildContext(user, personaKey);

    const safeRun = async (name: string, fn: () => Promise<void>): Promise<void> => {
      try {
        await fn();
      } catch (e) {
        this.logger.error(
          `${String(name)} failed for ${String(personaKey)}: ${e instanceof Error ? e.message : e}`
        );
      }
    };

    // Phase 1: Transactions + Valuations
    const txnBuilder = new TransactionsBuilder(this.prisma);
    const analyticsBuilder = new AnalyticsBuilder(this.prisma);
    await Promise.all([
      safeRun('transactions', () => txnBuilder.build(ctx)),
      safeRun('analytics', () => analyticsBuilder.build(ctx)),
    ]);

    // Phase 2: Goals + Simulations
    const goalsBuilder = new GoalsBuilder(this.prisma);
    const simsBuilder = new SimulationsBuilder(this.prisma);
    await Promise.all([
      safeRun('goals', () => goalsBuilder.build(ctx)),
      safeRun('simulations', () => simsBuilder.build(ctx)),
    ]);

    // Phase 3: Assets + ESG
    const assetsBuilder = new AssetsBuilder(this.prisma);
    const esgBuilder = new ESGBuilder(this.prisma);
    await Promise.all([
      safeRun('assets', () => assetsBuilder.build(ctx)),
      safeRun('esg', () => esgBuilder.build(ctx)),
    ]);

    // Phase 4: Estate + Recurring + Connections + Reports
    const estateBuilder = new EstateBuilder(this.prisma);
    const recurringBuilder = new RecurringBuilder(this.prisma);
    const connectionsBuilder = new ConnectionsBuilder(this.prisma);
    const reportsBuilder = new ReportsBuilder(this.prisma);
    await Promise.all([
      safeRun('estate', () => estateBuilder.build(ctx)),
      safeRun('recurring', () => recurringBuilder.build(ctx)),
      safeRun('connections', () => connectionsBuilder.build(ctx)),
      safeRun('reports', () => reportsBuilder.build(ctx)),
    ]);

    // Phase 5: Intelligence layer (cashflow, zero-based budgeting, household)
    const cashflowBuilder = new CashflowBuilder(this.prisma);
    const zeroBasedBuilder = new ZeroBasedBuilder(this.prisma);
    const householdBuilder = new HouseholdBuilder(this.prisma);
    await Promise.all([
      safeRun('cashflow', () => cashflowBuilder.build(ctx)),
      safeRun('zero-based', () => zeroBasedBuilder.build(ctx)),
      safeRun('household', () => householdBuilder.build(ctx)),
    ]);

    // Phase 6: Engagement layer (notifications, rules)
    const notificationsBuilder = new NotificationsBuilder(this.prisma);
    const rulesBuilder = new RulesBuilder(this.prisma);
    await Promise.all([
      safeRun('notifications', () => notificationsBuilder.build(ctx)),
      safeRun('rules', () => rulesBuilder.build(ctx)),
    ]);
  }

  private async buildContext(user: User, personaKey: string): Promise<DemoContext> {
    const userSpaces = await this.prisma.userSpace.findMany({
      where: { userId: user.id },
      include: {
        space: {
          include: {
            accounts: true,
            budgets: { include: { categories: true } },
          },
        },
      },
    });

    const spaces = userSpaces.map((us) => ({
      id: us.space.id,
      type: us.space.type,
      name: us.space.name,
      currency: us.space.currency,
    }));

    const accounts = userSpaces.flatMap((us) =>
      us.space.accounts.map((a) => ({
        id: a.id,
        spaceId: a.spaceId,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        currency: a.currency,
        balance: Number(a.balance),
        provider: a.provider,
        providerAccountId: a.providerAccountId,
      }))
    );

    const categories = userSpaces.flatMap((us) =>
      us.space.budgets.flatMap((b) =>
        b.categories.map((c) => ({
          id: c.id,
          budgetId: c.budgetId,
          name: c.name,
          spaceId: us.space.id,
        }))
      )
    );

    const budgets = userSpaces.flatMap((us) =>
      us.space.budgets.map((b) => ({
        id: b.id,
        spaceId: us.space.id,
        name: b.name,
      }))
    );

    return {
      user: { id: user.id, email: user.email },
      personaKey,
      spaces,
      accounts,
      categories,
      budgets,
    };
  }

  private async buildGuestPersona(geo: GeoDefaults): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: 'guest@dhanam.demo',
        passwordHash: 'GUEST_NO_PASSWORD',
        name: 'Guest User',
        locale: geo.locale,
        timezone: geo.timezone,
        emailVerified: true,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        subscriptionTier: 'pro',
      },
    });

    await this.prisma.space.create({
      data: {
        name: 'Demo Personal Finance',
        type: SpaceType.personal,
        currency: geo.currency as Currency,
        timezone: geo.timezone,
        userSpaces: { create: { userId: user.id, role: 'viewer' } },
        accounts: {
          create: [
            {
              provider: Provider.manual,
              providerAccountId: 'guest-checking',
              name: 'BBVA Checking',
              type: 'checking',
              subtype: 'checking',
              currency: Currency.MXN,
              balance: 45320.5,
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.manual,
              providerAccountId: 'guest-savings',
              name: 'Santander Savings',
              type: 'savings',
              subtype: 'savings',
              currency: Currency.MXN,
              balance: 125000,
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.manual,
              providerAccountId: 'guest-credit',
              name: 'Banamex Credit Card',
              type: 'credit',
              subtype: 'credit_card',
              currency: Currency.MXN,
              balance: -8500,
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.manual,
              providerAccountId: 'guest-crypto',
              name: 'Demo Crypto Wallet',
              type: 'crypto',
              subtype: 'exchange',
              currency: Currency.MXN,
              balance: 32000,
              lastSyncedAt: new Date(),
            },
          ],
        },
        budgets: {
          create: {
            name: 'Demo Monthly Budget',
            period: BudgetPeriod.monthly,
            income: 55000,
            startDate: startOfMonth(new Date()),
            endDate: endOfMonth(new Date()),
            categories: {
              create: [
                { name: 'Rent', budgetedAmount: 12000, color: '#FF6B6B', icon: '🏠' },
                { name: 'Groceries', budgetedAmount: 5000, color: '#4ECDC4', icon: '🛒' },
                { name: 'Transportation', budgetedAmount: 2500, color: '#45B7D1', icon: '🚗' },
                { name: 'Entertainment', budgetedAmount: 3000, color: '#96CEB4', icon: '🎬' },
                { name: 'Savings', budgetedAmount: 10000, color: '#FECA57', icon: '💰' },
                { name: 'Utilities', budgetedAmount: 2000, color: '#48C9B0', icon: '💡' },
              ],
            },
          },
        },
      },
    });

    return user;
  }

  private async buildMariaPersona(_geo: GeoDefaults): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: 'maria@dhanam.demo',
        passwordHash: 'DEMO_NO_PASSWORD',
        name: 'Maria González',
        locale: 'es',
        timezone: 'America/Mexico_City',
        emailVerified: true,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        subscriptionTier: 'pro',
      },
    });

    await this.prisma.space.create({
      data: {
        name: 'Personal',
        type: SpaceType.personal,
        currency: Currency.MXN,
        timezone: 'America/Mexico_City',
        userSpaces: { create: { userId: user.id, role: 'owner' } },
        accounts: {
          create: [
            {
              provider: Provider.belvo,
              providerAccountId: 'maria-bbva-checking',
              name: 'BBVA Nómina',
              type: 'checking',
              subtype: 'checking',
              currency: Currency.MXN,
              balance: 28750.3,
              metadata: { institutionName: 'BBVA México' },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.belvo,
              providerAccountId: 'maria-nu-savings',
              name: 'Nu Cuenta',
              type: 'savings',
              subtype: 'savings',
              currency: Currency.MXN,
              balance: 45000,
              metadata: { institutionName: 'Nu México' },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.bitso,
              providerAccountId: 'maria-bitso',
              name: 'Bitso Wallet',
              type: 'crypto',
              subtype: 'exchange',
              currency: Currency.MXN,
              balance: 15000,
              metadata: { institutionName: 'Bitso' },
              lastSyncedAt: new Date(),
            },
          ],
        },
        budgets: {
          create: {
            name: 'Monthly Budget',
            period: BudgetPeriod.monthly,
            income: 65000,
            startDate: startOfMonth(new Date()),
            endDate: endOfMonth(new Date()),
            categories: {
              create: [
                { name: 'Rent', budgetedAmount: 15000, color: '#FF6B6B', icon: '🏠' },
                { name: 'Groceries', budgetedAmount: 6000, color: '#4ECDC4', icon: '🛒' },
                { name: 'Savings', budgetedAmount: 15000, color: '#FECA57', icon: '💰' },
                { name: 'Entertainment', budgetedAmount: 4000, color: '#96CEB4', icon: '🎬' },
              ],
            },
          },
        },
      },
    });

    return user;
  }

  private async buildCarlosPersona(_geo: GeoDefaults): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: 'carlos@dhanam.demo',
        passwordHash: 'DEMO_NO_PASSWORD',
        name: 'Carlos Mendoza',
        locale: 'es',
        timezone: 'America/Mexico_City',
        emailVerified: true,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        subscriptionTier: 'pro',
      },
    });

    // Personal space
    await this.prisma.space.create({
      data: {
        name: 'Personal',
        type: SpaceType.personal,
        currency: Currency.MXN,
        timezone: 'America/Mexico_City',
        userSpaces: { create: { userId: user.id, role: 'owner' } },
        accounts: {
          create: [
            {
              provider: Provider.manual,
              providerAccountId: 'carlos-personal-checking',
              name: 'Santander Personal',
              type: 'checking',
              subtype: 'checking',
              currency: Currency.MXN,
              balance: 156000,
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.manual,
              providerAccountId: 'carlos-investment',
              name: 'GBM+ Investment',
              type: 'investment',
              subtype: 'brokerage',
              currency: Currency.MXN,
              balance: 450000,
              lastSyncedAt: new Date(),
            },
          ],
        },
      },
    });

    // Business space
    await this.prisma.space.create({
      data: {
        name: 'Tacos El Patrón',
        type: SpaceType.business,
        currency: Currency.MXN,
        timezone: 'America/Mexico_City',
        userSpaces: { create: { userId: user.id, role: 'owner' } },
        accounts: {
          create: [
            {
              provider: Provider.belvo,
              providerAccountId: 'business-main',
              name: 'BBVA Business',
              type: 'checking',
              subtype: 'business_checking',
              currency: Currency.MXN,
              balance: 285000,
              metadata: { institutionName: 'BBVA México' },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.manual,
              providerAccountId: 'business-savings',
              name: 'Banorte Business Savings',
              type: 'savings',
              subtype: 'business_savings',
              currency: Currency.MXN,
              balance: 520000,
              lastSyncedAt: new Date(),
            },
          ],
        },
        budgets: {
          create: {
            name: 'Q1 Budget',
            period: BudgetPeriod.quarterly,
            income: 1500000,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-03-31'),
            categories: {
              create: [
                { name: 'Payroll', budgetedAmount: 450000, color: '#FF6B6B', icon: '👥' },
                { name: 'Inventory', budgetedAmount: 300000, color: '#4ECDC4', icon: '📦' },
                { name: 'Rent', budgetedAmount: 105000, color: '#45B7D1', icon: '🏢' },
              ],
            },
          },
        },
      },
    });

    return user;
  }

  private async buildPatriciaPersona(_geo: GeoDefaults): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: 'patricia@dhanam.demo',
        passwordHash: 'DEMO_NO_PASSWORD',
        name: 'Patricia Ruiz',
        locale: 'en',
        timezone: 'America/Mexico_City',
        emailVerified: true,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        subscriptionTier: 'pro',
      },
    });

    await this.prisma.space.create({
      data: {
        name: 'TechCorp México',
        type: SpaceType.business,
        currency: Currency.USD,
        timezone: 'America/Mexico_City',
        userSpaces: { create: [{ userId: user.id, role: 'owner' }] },
        accounts: {
          create: [
            {
              provider: Provider.plaid,
              providerAccountId: 'enterprise-chase',
              name: 'Chase Business Checking',
              type: 'checking',
              subtype: 'business_checking',
              currency: Currency.USD,
              balance: 2500000,
              metadata: { institutionName: 'Chase Bank' },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.plaid,
              providerAccountId: 'enterprise-amex',
              name: 'Amex Corporate Platinum',
              type: 'credit',
              subtype: 'corporate_card',
              currency: Currency.USD,
              balance: -125000,
              metadata: { institutionName: 'American Express' },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.manual,
              providerAccountId: 'enterprise-investment',
              name: 'Vanguard Investment',
              type: 'investment',
              subtype: 'retirement',
              currency: Currency.USD,
              balance: 5000000,
              lastSyncedAt: new Date(),
            },
          ],
        },
        budgets: {
          create: {
            name: 'Annual Budget',
            period: BudgetPeriod.yearly,
            income: 10000000,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            categories: {
              create: [
                { name: 'Salaries', budgetedAmount: 5000000, color: '#FF6B6B', icon: '💼' },
                { name: 'Infrastructure', budgetedAmount: 1500000, color: '#4ECDC4', icon: '🖥️' },
                { name: 'R&D', budgetedAmount: 1500000, color: '#96CEB4', icon: '🔬' },
              ],
            },
          },
        },
      },
    });

    return user;
  }

  private async buildDiegoPersona(_geo: GeoDefaults): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: 'diego@dhanam.demo',
        passwordHash: 'DEMO_NO_PASSWORD',
        name: 'Diego Navarro',
        locale: 'es',
        timezone: 'America/Mexico_City',
        emailVerified: true,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        subscriptionTier: 'pro',
      },
    });

    await this.prisma.space.create({
      data: {
        name: 'Personal',
        type: SpaceType.personal,
        currency: Currency.MXN,
        timezone: 'America/Mexico_City',
        userSpaces: { create: { userId: user.id, role: 'owner' } },
        accounts: {
          create: [
            {
              provider: Provider.belvo,
              providerAccountId: 'diego-bbva-checking',
              name: 'BBVA Nómina',
              type: 'checking',
              subtype: 'checking',
              currency: Currency.MXN,
              balance: 42500,
              metadata: { institutionName: 'BBVA México' },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.bitso,
              providerAccountId: 'diego-bitso',
              name: 'Bitso Exchange',
              type: 'crypto',
              subtype: 'exchange',
              currency: Currency.MXN,
              balance: 95000,
              metadata: { institutionName: 'Bitso' },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.blockchain,
              providerAccountId: 'diego-eth-wallet',
              name: 'ETH Wallet',
              type: 'crypto',
              subtype: 'wallet',
              currency: Currency.USD,
              balance: 12500,
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.blockchain,
              providerAccountId: 'diego-defi-ethereum',
              name: 'Ethereum DeFi Wallet',
              type: 'crypto',
              subtype: 'defi',
              currency: Currency.USD,
              balance: 28500,
              metadata: { network: 'ethereum', protocols: ['uniswap', 'aave', 'curve', 'lido'] },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.blockchain,
              providerAccountId: 'diego-defi-polygon',
              name: 'Polygon DeFi Wallet',
              type: 'crypto',
              subtype: 'defi',
              currency: Currency.USD,
              balance: 6200,
              metadata: { network: 'polygon', protocols: ['quickswap', 'aave-polygon'] },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.manual,
              providerAccountId: 'diego-sandbox-land',
              name: 'Sandbox LAND Portfolio',
              type: 'crypto',
              subtype: 'gaming',
              currency: Currency.USD,
              balance: 7800,
              metadata: { platform: 'The Sandbox' },
              lastSyncedAt: new Date(),
            },
            {
              provider: Provider.blockchain,
              providerAccountId: 'diego-dao-governance',
              name: 'DAO Governance Tokens',
              type: 'crypto',
              subtype: 'wallet',
              currency: Currency.USD,
              balance: 9400,
              metadata: { tokens: { ENS: 2400, UNI: 3600, AAVE: 3400 } },
              lastSyncedAt: new Date(),
            },
          ],
        },
        budgets: {
          create: {
            name: 'Monthly Budget',
            period: BudgetPeriod.monthly,
            income: 55000,
            startDate: startOfMonth(new Date()),
            endDate: endOfMonth(new Date()),
            categories: {
              create: [
                { name: 'Rent', budgetedAmount: 12000, color: '#FF6B6B', icon: '🏠' },
                { name: 'Crypto Investments', budgetedAmount: 10000, color: '#F7931A', icon: '₿' },
                { name: 'Gaming Purchases', budgetedAmount: 2000, color: '#E74C3C', icon: '🕹️' },
                { name: 'Gas Fees', budgetedAmount: 500, color: '#95A5A6', icon: '⛽' },
              ],
            },
          },
        },
      },
    });

    return user;
  }
}
