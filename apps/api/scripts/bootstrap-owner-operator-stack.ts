#!/usr/bin/env ts-node
/**
 * Bootstrap owner-operator capital stack for production/staging.
 * Requires operator emails and RFC from Vault — never hardcode in this script.
 *
 * Usage:
 *   BENEFICIAL_OWNER_EMAIL=... OPERATOR_EMAIL=... MADFAM_BUSINESS_RFC=... \
 *   BUSINESS_SPACE_NAME="Innovaciones MADFAM" PERSONAL_SPACE_NAME="Aldo Personal" \
 *   pnpm exec ts-node scripts/bootstrap-owner-operator-stack.ts
 *
 * Add --dry-run to print resolved ids without writing.
 */
import { PrismaClient, HouseholdType } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const beneficialOwnerEmail = process.env.BENEFICIAL_OWNER_EMAIL;
  const operatorEmail = process.env.OPERATOR_EMAIL;
  const taxId = process.env.MADFAM_BUSINESS_RFC;
  const businessSpaceName = process.env.BUSINESS_SPACE_NAME;
  const personalSpaceName = process.env.PERSONAL_SPACE_NAME;
  const legalName = process.env.ENTITY_LEGAL_NAME || 'Innovaciones MADFAM S.A.S. de C.V.';
  const groupName = process.env.ENTITY_GROUP_NAME || `${legalName} — Owner Operator Stack`;

  for (const [key, val] of [
    ['BENEFICIAL_OWNER_EMAIL', beneficialOwnerEmail],
    ['OPERATOR_EMAIL', operatorEmail],
    ['MADFAM_BUSINESS_RFC', taxId],
    ['BUSINESS_SPACE_NAME', businessSpaceName],
    ['PERSONAL_SPACE_NAME', personalSpaceName],
  ] as const) {
    if (!val) {
      console.error(`ERROR: ${key} is required`);
      process.exit(1);
    }
  }

  const [owner, operator, personalSpace, businessSpace] = await Promise.all([
    prisma.user.findUnique({ where: { email: beneficialOwnerEmail! } }),
    prisma.user.findUnique({ where: { email: operatorEmail! } }),
    prisma.space.findFirst({ where: { name: personalSpaceName! } }),
    prisma.space.findFirst({ where: { name: businessSpaceName!, type: 'business' } }),
  ]);

  if (!owner || !operator || !personalSpace || !businessSpace) {
    console.error('ERROR: missing user or space rows', {
      owner: !!owner,
      operator: !!operator,
      personalSpace: !!personalSpace,
      businessSpace: !!businessSpace,
    });
    process.exit(1);
  }

  const existing = await prisma.household.findFirst({
    where: {
      type: HouseholdType.owner_operator,
      beneficialOwnerUserId: owner.id,
    },
  });

  if (existing) {
    console.log(`Entity group already exists: ${existing.id}`);
    process.exit(0);
  }

  console.log('Resolved bootstrap targets:', {
    ownerId: owner.id,
    operatorId: operator.id,
    personalSpaceId: personalSpace.id,
    businessSpaceId: businessSpace.id,
    dryRun,
  });

  if (dryRun) {
    return;
  }

  const { household, binding } = await prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        name: groupName,
        type: HouseholdType.owner_operator,
        baseCurrency: 'MXN',
        beneficialOwnerUserId: owner.id,
        members: {
          create: [
            { userId: owner.id, relationship: 'other' },
            { userId: operator.id, relationship: 'other' },
          ],
        },
      },
    });

    await tx.space.updateMany({
      where: { id: { in: [personalSpace.id, businessSpace.id] } },
      data: { householdId: household.id },
    });

    const binding = await tx.spaceOperatorBinding.create({
      data: {
        spaceId: businessSpace.id,
        operatorUserId: operator.id,
        beneficialOwnerUserId: owner.id,
        legalName,
        taxId: taxId!,
      },
    });

    const access = await tx.userSpace.findUnique({
      where: {
        userId_spaceId: { userId: owner.id, spaceId: businessSpace.id },
      },
    });

    if (!access) {
      await tx.userSpace.create({
        data: { userId: owner.id, spaceId: businessSpace.id, role: 'admin' },
      });
    }

    return { household, binding };
  });

  console.log('Bootstrap complete:', {
    entityGroupId: household.id,
    bindingId: binding.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
