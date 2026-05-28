import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

/**
 * MADFAM Internal Finance Seed
 *
 * Configures Dhanam for MADFAM ecosystem operations tracking.
 * This enables "eating our own dog food" - using Dhanam for internal finance.
 *
 * Categories follow the MADFAM layer architecture:
 * - SOIL: Infrastructure (Janua, Enclii)
 * - STEM: Shared capabilities (geom-core, AVALA)
 * - FRUIT: Revenue-generating products (Yantra4D, Cotiza Studio, Dhanam, etc.)
 */

async function main() {
  console.log('🌱 Seeding MADFAM internal finance configuration...');

  // Require password from environment — no fallbacks
  const adminPassword = process.env.MADFAM_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      'MADFAM_ADMIN_PASSWORD env var required for seeding. Generate with: openssl rand -base64 24'
    );
  }

  // Require operator email from environment — no hardcoded defaults in public repo
  const adminEmail = process.env.MADFAM_ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error(
      'MADFAM_ADMIN_EMAIL env var required for seeding. Use your operator account email.'
    );
  }

  // Create MADFAM admin user (will be linked to Janua SSO in production)
  const madfamAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      isAdmin: true,
      subscriptionTier: 'premium',
    },
    create: {
      email: adminEmail,
      passwordHash: await hash(adminPassword),
      name: 'MADFAM Admin',
      locale: 'en',
      timezone: 'America/Mexico_City',
      emailVerified: true,
      onboardingCompleted: true,
      isAdmin: true,
      subscriptionTier: 'premium',
    },
  });

  console.log('✅ Created MADFAM admin user:', madfamAdmin.email);

  // Create MADFAM Business Space
  const madfamSpace = await prisma.space.upsert({
    where: { id: 'madfam-operations' },
    update: {},
    create: {
      id: 'madfam-operations',
      name: 'MADFAM Operations',
      type: 'business',
      currency: 'USD',
      timezone: 'America/Mexico_City',
      userSpaces: {
        create: {
          userId: madfamAdmin.id,
          role: 'owner',
        },
      },
    },
  });

  console.log('✅ Created MADFAM business space:', madfamSpace.name);

  // Create MADFAM Operations Budget with ecosystem-aligned categories
  const operationsBudget = await prisma.budget.create({
    data: {
      spaceId: madfamSpace.id,
      name: 'MADFAM Operations FY2025',
      period: 'yearly',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      categories: {
        create: [
          // === REVENUE CATEGORIES (Income) ===
          {
            name: '💰 Revenue: Yantra4D Studio',
            budgetedAmount: 0, // Revenue tracked, not budgeted
            color: '#22c55e',
            icon: 'trending-up',
          },
          {
            name: '💰 Revenue: Cotiza Studio',
            budgetedAmount: 0,
            color: '#16a34a',
            icon: 'trending-up',
          },
          {
            name: '💰 Revenue: ForgeSight',
            budgetedAmount: 0,
            color: '#15803d',
            icon: 'trending-up',
          },
          {
            name: '💰 Revenue: Consulting',
            budgetedAmount: 0,
            color: '#166534',
            icon: 'briefcase',
          },

          // === INFRASTRUCTURE COSTS (SOIL Layer) ===
          {
            name: '🏗️ Infra: Cloud Services',
            budgetedAmount: 5000,
            color: '#3b82f6',
            icon: 'cloud',
          },
          {
            name: '🏗️ Infra: Domains & DNS',
            budgetedAmount: 500,
            color: '#2563eb',
            icon: 'globe',
          },
          {
            name: '🏗️ Infra: Security & Compliance',
            budgetedAmount: 2000,
            color: '#1d4ed8',
            icon: 'shield',
          },
          {
            name: '🏗️ Infra: Development Tools',
            budgetedAmount: 1500,
            color: '#1e40af',
            icon: 'code',
          },

          // === PRODUCT COSTS (FRUIT Layer) ===
          {
            name: '🎨 Product: Yantra4D Operations',
            budgetedAmount: 3000,
            color: '#a855f7',
            icon: 'cube',
          },
          {
            name: '🏭 Product: Cotiza Maker Nodes',
            budgetedAmount: 10000,
            color: '#9333ea',
            icon: 'box',
          },
          {
            name: '🔍 Product: ForgeSight Data',
            budgetedAmount: 1000,
            color: '#7e22ce',
            icon: 'search',
          },
          {
            name: '📊 Product: Dhanam Hosting',
            budgetedAmount: 500,
            color: '#6b21a8',
            icon: 'database',
          },

          // === PEOPLE & OPERATIONS ===
          {
            name: '👥 Team: Contractors',
            budgetedAmount: 15000,
            color: '#f59e0b',
            icon: 'users',
          },
          {
            name: '👥 Team: Benefits & Perks',
            budgetedAmount: 2000,
            color: '#d97706',
            icon: 'gift',
          },
          {
            name: '📚 Team: Training & Learning',
            budgetedAmount: 1500,
            color: '#b45309',
            icon: 'book',
          },

          // === MARKETING & GROWTH ===
          {
            name: '📣 Marketing: Advertising',
            budgetedAmount: 3000,
            color: '#ef4444',
            icon: 'megaphone',
          },
          {
            name: '📣 Marketing: Content & Design',
            budgetedAmount: 1000,
            color: '#dc2626',
            icon: 'edit',
          },
          {
            name: '🤝 Growth: Events & Networking',
            budgetedAmount: 2000,
            color: '#b91c1c',
            icon: 'calendar',
          },

          // === LEGAL & ADMIN ===
          {
            name: '⚖️ Legal: IP & Trademarks',
            budgetedAmount: 2000,
            color: '#6b7280',
            icon: 'file-text',
          },
          {
            name: '📋 Admin: Accounting & Tax',
            budgetedAmount: 3000,
            color: '#4b5563',
            icon: 'calculator',
          },
          {
            name: '🏢 Admin: Office & Supplies',
            budgetedAmount: 500,
            color: '#374151',
            icon: 'building',
          },

          // === ESG & SUSTAINABILITY ===
          {
            name: '🌱 ESG: Carbon Offsets',
            budgetedAmount: 500,
            color: '#10b981',
            icon: 'leaf',
          },
          {
            name: '🌍 ESG: Community Initiatives',
            budgetedAmount: 1000,
            color: '#059669',
            icon: 'heart',
          },
        ],
      },
    },
  });

  console.log('✅ Created MADFAM operations budget with', 23, 'categories');

  // Create MADFAM accounts
  const operationsAccount = await prisma.account.create({
    data: {
      spaceId: madfamSpace.id,
      provider: 'manual',
      providerAccountId: 'madfam-operations-usd',
      name: 'MADFAM Operations (USD)',
      type: 'checking',
      subtype: 'business_checking',
      currency: 'USD',
      balance: 0,
      lastSyncedAt: new Date(),
    },
  });

  const mxnAccount = await prisma.account.create({
    data: {
      spaceId: madfamSpace.id,
      provider: 'manual',
      providerAccountId: 'madfam-operations-mxn',
      name: 'MADFAM Operations (MXN)',
      type: 'checking',
      subtype: 'business_checking',
      currency: 'MXN',
      balance: 0,
      lastSyncedAt: new Date(),
    },
  });

  const cryptoAccount = await prisma.account.create({
    data: {
      spaceId: madfamSpace.id,
      provider: 'manual',
      providerAccountId: 'madfam-crypto',
      name: 'MADFAM Crypto Holdings',
      type: 'investment',
      subtype: 'crypto',
      currency: 'USD',
      balance: 0,
      lastSyncedAt: new Date(),
    },
  });

  console.log('✅ Created MADFAM accounts (USD, MXN, Crypto)');

  // Create product-specific sub-spaces for detailed tracking
  const productSpaces = [
    { id: 'madfam-yantra4d', name: 'Yantra4D Business Unit', currency: 'USD' },
    { id: 'madfam-cotiza', name: 'Cotiza Studio Maker Nodes', currency: 'MXN' },
    { id: 'madfam-forgesight', name: 'ForgeSight Intelligence', currency: 'USD' },
  ];

  for (const product of productSpaces) {
    await prisma.space.upsert({
      where: { id: product.id },
      update: {},
      create: {
        id: product.id,
        name: product.name,
        type: 'business',
        currency: product.currency,
        timezone: 'America/Mexico_City',
        userSpaces: {
          create: {
            userId: madfamAdmin.id,
            role: 'owner',
          },
        },
      },
    });
    console.log(`✅ Created product space: ${product.name}`);
  }

  console.log('');
  console.log('✨ MADFAM internal finance configured successfully!');
  console.log('');
  console.log('📊 Configuration Summary:');
  console.log('   - Admin user: finance@madfam.org');
  console.log('   - Main space: MADFAM Operations');
  console.log('   - Budget categories: 23 (revenue, infra, product, team, marketing, legal, ESG)');
  console.log('   - Accounts: USD Operations, MXN Operations, Crypto Holdings');
  console.log('   - Product spaces: Yantra4D, Cotiza Studio, ForgeSight');
  console.log('');
  console.log('🔐 Next steps:');
  console.log('   1. Link finance@madfam.org to Janua SSO');
  console.log('   2. Import historical transactions from accounting system');
  console.log('   3. Connect to bank feeds (Plaid/Belvo) when ready');
  console.log('   4. Set up recurring transaction rules');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding MADFAM config:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
