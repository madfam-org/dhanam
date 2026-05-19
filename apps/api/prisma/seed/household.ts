import { PrismaClient, Currency } from '../../generated/prisma';
import { subDays } from 'date-fns';
import { SeedContext } from './helpers';

export async function seedHousehold(prisma: PrismaClient, ctx: SeedContext) {
  console.log('\n🏠 Creating demo household with estate planning...');

  const demoHousehold = await prisma.household.create({
    data: {
      name: 'The Demo Family',
      type: 'family',
      baseCurrency: Currency.MXN,
      description:
        'Demo household showcasing family financial planning and estate management features',
    },
  });

  // Add household members
  const [guestMember, mariaMember, childMember] = await Promise.all([
    prisma.householdMember.create({
      data: {
        householdId: demoHousehold.id,
        userId: ctx.guestUser.id,
        relationship: 'spouse',
        isMinor: false,
        notes: 'Head of household - primary financial planner',
      },
    }),
    prisma.householdMember.create({
      data: {
        householdId: demoHousehold.id,
        userId: ctx.mariaUser.id,
        relationship: 'spouse',
        isMinor: false,
        notes: 'Co-head of household - shared financial management',
      },
    }),
    prisma.householdMember.create({
      data: {
        householdId: demoHousehold.id,
        userId: ctx.carlosUser.id,
        relationship: 'child',
        isMinor: false,
        accessStartDate: new Date('2015-01-01'),
        notes: 'Adult child - included in estate planning',
      },
    }),
  ]);

  // Link household to Guest's space
  await prisma.space.update({
    where: { id: ctx.guestSpace.id },
    data: { householdId: demoHousehold.id },
  });

  console.log(`  ✓ Created household: ${demoHousehold.name}`);
  console.log(`  ✓ Added 3 household members (Guest, Maria, Carlos as adult child)`);

  // Create Will
  const demoWill = await prisma.will.create({
    data: {
      householdId: demoHousehold.id,
      name: 'Demo Family Estate Plan 2025',
      status: 'active',
      lastReviewedAt: subDays(new Date(), 30),
      activatedAt: subDays(new Date(), 90),
      notes:
        'Primary estate plan for the Demo Family. This is a demonstration document - not legal advice.',
      legalDisclaimer: true,
    },
  });

  console.log(`  ✓ Created will: ${demoWill.name}`);

  // Beneficiary designations + executors (parallel)
  await Promise.all([
    prisma.beneficiaryDesignation.create({
      data: {
        willId: demoWill.id,
        beneficiaryId: mariaMember.id,
        assetType: 'bank_account',
        percentage: 50.0,
        notes: 'Primary beneficiary for all liquid assets',
      },
    }),
    prisma.beneficiaryDesignation.create({
      data: {
        willId: demoWill.id,
        beneficiaryId: childMember.id,
        assetType: 'bank_account',
        percentage: 50.0,
        conditions: { type: 'age_requirement', minAge: 25, notes: 'Full access at age 25' },
        notes: 'Secondary beneficiary - assets held in trust until age requirements met',
      },
    }),
    prisma.beneficiaryDesignation.create({
      data: {
        willId: demoWill.id,
        beneficiaryId: childMember.id,
        assetType: 'crypto_account',
        percentage: 100.0,
        notes: 'All cryptocurrency holdings to next generation',
      },
    }),
    prisma.willExecutor.create({
      data: {
        willId: demoWill.id,
        executorId: mariaMember.id,
        isPrimary: true,
        order: 1,
        acceptedAt: subDays(new Date(), 85),
        notes: 'Primary executor - spouse',
      },
    }),
    prisma.willExecutor.create({
      data: {
        willId: demoWill.id,
        executorId: childMember.id,
        isPrimary: false,
        order: 2,
        acceptedAt: subDays(new Date(), 80),
        notes: 'Secondary executor if primary unable to serve',
      },
    }),
  ]);

  console.log('  ✓ Created 3 beneficiary designations');
  console.log('  ✓ Created 2 will executors (primary + backup)');
}
