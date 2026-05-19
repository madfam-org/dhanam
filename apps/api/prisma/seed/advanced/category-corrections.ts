import { PrismaClient } from '../../../generated/prisma';
import { SeedContext } from '../helpers';

export async function seedCategoryCorrections(prisma: PrismaClient, ctx: SeedContext) {
  // 6. CATEGORY CORRECTIONS (AI feedback loop)
  console.log('\n🔄 Creating category corrections...');

  const guestCategories = await prisma.category.findMany({
    where: { budget: { spaceId: ctx.guestSpace.id } },
  });
  const guestTxns = await prisma.transaction.findMany({
    where: { account: { spaceId: ctx.guestSpace.id } },
    take: 20,
    orderBy: { date: 'desc' },
  });

  const groceryCat = guestCategories.find((c) => c.name === 'Groceries');
  const transportCat = guestCategories.find((c) => c.name === 'Transportation');
  const foodCat = guestCategories.find((c) => c.name === 'Food & Dining');
  const shoppingCat = guestCategories.find((c) => c.name === 'Shopping');
  const entertainmentCat = guestCategories.find((c) => c.name === 'Entertainment');
  const utilitiesCat = guestCategories.find((c) => c.name === 'Utilities');

  const correctionRows: Array<{
    spaceId: string;
    transactionId: string;
    originalCategoryId: string | null;
    correctedCategoryId: string;
    merchantPattern: string;
    descriptionPattern: string | null;
    confidence: number;
    createdBy: string;
    appliedToFuture: boolean;
  }> = [];

  if (
    guestTxns.length >= 6 &&
    foodCat &&
    transportCat &&
    groceryCat &&
    shoppingCat &&
    entertainmentCat &&
    utilitiesCat
  ) {
    correctionRows.push(
      {
        spaceId: ctx.guestSpace.id,
        transactionId: guestTxns[0].id,
        originalCategoryId: transportCat.id,
        correctedCategoryId: foodCat.id,
        merchantPattern: 'uber eats',
        descriptionPattern: 'uber eats mx',
        confidence: 0.72,
        createdBy: ctx.guestUser.id,
        appliedToFuture: true,
      },
      {
        spaceId: ctx.guestSpace.id,
        transactionId: guestTxns[1].id,
        originalCategoryId: shoppingCat.id,
        correctedCategoryId: groceryCat.id,
        merchantPattern: 'oxxo',
        descriptionPattern: 'oxxo',
        confidence: 0.65,
        createdBy: ctx.guestUser.id,
        appliedToFuture: true,
      },
      {
        spaceId: ctx.guestSpace.id,
        transactionId: guestTxns[2].id,
        originalCategoryId: entertainmentCat.id,
        correctedCategoryId: foodCat.id,
        merchantPattern: 'rappi',
        descriptionPattern: 'rappi',
        confidence: 0.58,
        createdBy: ctx.guestUser.id,
        appliedToFuture: true,
      },
      {
        spaceId: ctx.guestSpace.id,
        transactionId: guestTxns[3].id,
        originalCategoryId: shoppingCat.id,
        correctedCategoryId: groceryCat.id,
        merchantPattern: 'mercadolibre',
        descriptionPattern: 'mercadolibre groceries',
        confidence: 0.45,
        createdBy: ctx.guestUser.id,
        appliedToFuture: false,
      },
      {
        spaceId: ctx.guestSpace.id,
        transactionId: guestTxns[4].id,
        originalCategoryId: transportCat.id,
        correctedCategoryId: utilitiesCat.id,
        merchantPattern: 'cabify',
        descriptionPattern: null,
        confidence: 0.8,
        createdBy: ctx.guestUser.id,
        appliedToFuture: true,
      },
      {
        spaceId: ctx.guestSpace.id,
        transactionId: guestTxns[5].id,
        originalCategoryId: shoppingCat.id,
        correctedCategoryId: entertainmentCat.id,
        merchantPattern: 'coppel',
        descriptionPattern: 'coppel gaming',
        confidence: 0.55,
        createdBy: ctx.guestUser.id,
        appliedToFuture: false,
      }
    );
  }

  // Maria corrections
  const mariaCategories = await prisma.category.findMany({
    where: { budget: { spaceId: ctx.mariaSpace.id } },
  });
  const mariaTxns = await prisma.transaction.findMany({
    where: { account: { spaceId: ctx.mariaSpace.id } },
    take: 10,
    orderBy: { date: 'desc' },
  });
  const mariaTransportCat = mariaCategories.find((c) => c.name === 'Transportation');
  const mariaFoodCat = mariaCategories.find((c) => c.name === 'Food & Dining');
  const mariaShoppingCat = mariaCategories.find(
    (c) => c.name === 'Shopping' || c.name === 'Groceries'
  );
  const mariaEntertainmentCat = mariaCategories.find((c) => c.name === 'Entertainment');
  const mariaGroceryCat = mariaCategories.find((c) => c.name === 'Groceries');

  if (mariaTxns.length >= 4 && mariaTransportCat && mariaFoodCat) {
    correctionRows.push(
      {
        spaceId: ctx.mariaSpace.id,
        transactionId: mariaTxns[0].id,
        originalCategoryId: mariaTransportCat.id,
        correctedCategoryId: mariaFoodCat.id,
        merchantPattern: 'uber eats',
        descriptionPattern: 'uber eats mx',
        confidence: 0.7,
        createdBy: ctx.mariaUser.id,
        appliedToFuture: true,
      },
      {
        spaceId: ctx.mariaSpace.id,
        transactionId: mariaTxns[1].id,
        originalCategoryId: mariaShoppingCat?.id ?? mariaFoodCat.id,
        correctedCategoryId: mariaFoodCat.id,
        merchantPattern: 'rappi',
        descriptionPattern: 'rappi',
        confidence: 0.62,
        createdBy: ctx.mariaUser.id,
        appliedToFuture: true,
      }
    );
    if (mariaEntertainmentCat && mariaGroceryCat && mariaTxns.length >= 6) {
      correctionRows.push(
        {
          spaceId: ctx.mariaSpace.id,
          transactionId: mariaTxns[2].id,
          originalCategoryId: mariaEntertainmentCat.id,
          correctedCategoryId: mariaGroceryCat.id,
          merchantPattern: 'costco',
          descriptionPattern: 'costco',
          confidence: 0.55,
          createdBy: ctx.mariaUser.id,
          appliedToFuture: true,
        },
        {
          spaceId: ctx.mariaSpace.id,
          transactionId: mariaTxns[3].id,
          originalCategoryId: mariaGroceryCat.id,
          correctedCategoryId: mariaEntertainmentCat.id,
          merchantPattern: 'cinepolis',
          descriptionPattern: 'cinepolis',
          confidence: 0.78,
          createdBy: ctx.mariaUser.id,
          appliedToFuture: true,
        }
      );
    }
  }

  // Carlos corrections
  const carlosPersonalCategories = await prisma.category.findMany({
    where: { budget: { spaceId: ctx.carlosPersonal.id } },
  });
  const carlosBusinessCategories = await prisma.category.findMany({
    where: { budget: { spaceId: ctx.carlosBusiness.id } },
  });
  const carlosPersonalTxns = await prisma.transaction.findMany({
    where: { account: { spaceId: ctx.carlosPersonal.id } },
    take: 6,
    orderBy: { date: 'desc' },
  });
  const carlosBusinessTxns = await prisma.transaction.findMany({
    where: { account: { spaceId: ctx.carlosBusiness.id } },
    take: 6,
    orderBy: { date: 'desc' },
  });

  const carlosPersonalShopping = carlosPersonalCategories.find((c) => c.name === 'Shopping');
  const carlosBusinessSupplies = carlosBusinessCategories.find(
    (c) => c.name === 'Supplies' || c.name === 'Equipment'
  );
  const carlosBusinessMarketing = carlosBusinessCategories.find((c) => c.name === 'Marketing');
  const carlosBusinessRent = carlosBusinessCategories.find((c) => c.name === 'Rent');

  if (carlosBusinessTxns.length >= 4 && carlosBusinessSupplies && carlosBusinessMarketing) {
    correctionRows.push({
      spaceId: ctx.carlosBusiness.id,
      transactionId: carlosBusinessTxns[0].id,
      originalCategoryId: carlosBusinessMarketing.id,
      correctedCategoryId: carlosBusinessSupplies.id,
      merchantPattern: 'office depot',
      descriptionPattern: 'office depot',
      confidence: 0.68,
      createdBy: ctx.carlosUser.id,
      appliedToFuture: true,
    });
    if (carlosBusinessRent) {
      correctionRows.push({
        spaceId: ctx.carlosBusiness.id,
        transactionId: carlosBusinessTxns[1].id,
        originalCategoryId: carlosBusinessRent.id,
        correctedCategoryId: carlosBusinessSupplies.id,
        merchantPattern: 'home depot',
        descriptionPattern: 'home depot business',
        confidence: 0.6,
        createdBy: ctx.carlosUser.id,
        appliedToFuture: false,
      });
    }
  }

  // Diego corrections
  const diegoCategories = await prisma.category.findMany({
    where: { budget: { spaceId: ctx.diegoSpace.id } },
  });
  const diegoTxns = await prisma.transaction.findMany({
    where: { account: { spaceId: ctx.diegoSpace.id } },
    take: 10,
    orderBy: { date: 'desc' },
  });
  const diegoTransportCat = diegoCategories.find((c) => c.name === 'Transportation');
  const diegoGasFeeCat = diegoCategories.find((c) => c.name === 'Gas Fees');
  const diegoCryptoCat = diegoCategories.find((c) => c.name === 'Crypto Investments');
  const diegoEntertainmentCat = diegoCategories.find((c) => c.name === 'Entertainment');

  if (diegoTxns.length >= 4 && diegoTransportCat && diegoGasFeeCat) {
    correctionRows.push({
      spaceId: ctx.diegoSpace.id,
      transactionId: diegoTxns[0].id,
      originalCategoryId: diegoTransportCat.id,
      correctedCategoryId: diegoGasFeeCat.id,
      merchantPattern: 'ethereum gas',
      descriptionPattern: 'gas fee',
      confidence: 0.82,
      createdBy: ctx.diegoUser.id,
      appliedToFuture: true,
    });
    if (diegoCryptoCat && diegoEntertainmentCat) {
      correctionRows.push(
        {
          spaceId: ctx.diegoSpace.id,
          transactionId: diegoTxns[1].id,
          originalCategoryId: diegoEntertainmentCat.id,
          correctedCategoryId: diegoCryptoCat.id,
          merchantPattern: 'sandbox',
          descriptionPattern: 'sandbox land',
          confidence: 0.75,
          createdBy: ctx.diegoUser.id,
          appliedToFuture: true,
        },
        {
          spaceId: ctx.diegoSpace.id,
          transactionId: diegoTxns[2].id,
          originalCategoryId: diegoTransportCat.id,
          correctedCategoryId: diegoGasFeeCat.id,
          merchantPattern: 'polygon gas',
          descriptionPattern: 'polygon bridge fee',
          confidence: 0.8,
          createdBy: ctx.diegoUser.id,
          appliedToFuture: true,
        }
      );
    }
  }

  // Patricia corrections
  const patriciaCategories = await prisma.category.findMany({
    where: { budget: { spaceId: ctx.enterpriseSpace.id } },
  });
  const patriciaTxns = await prisma.transaction.findMany({
    where: { account: { spaceId: ctx.enterpriseSpace.id } },
    take: 6,
    orderBy: { date: 'desc' },
  });
  const patriciaMarketing = patriciaCategories.find((c) => c.name === 'Marketing');
  const patriciaInfra = patriciaCategories.find((c) => c.name === 'Infrastructure');
  const patriciaOps = patriciaCategories.find((c) => c.name === 'Operations');
  const patriciaTravel = patriciaCategories.find((c) => c.name === 'Travel');

  if (patriciaTxns.length >= 4 && patriciaMarketing && patriciaInfra) {
    correctionRows.push({
      spaceId: ctx.enterpriseSpace.id,
      transactionId: patriciaTxns[0].id,
      originalCategoryId: patriciaMarketing.id,
      correctedCategoryId: patriciaInfra.id,
      merchantPattern: 'aws',
      descriptionPattern: 'aws',
      confidence: 0.85,
      createdBy: ctx.adminUser.id,
      appliedToFuture: true,
    });
    if (patriciaOps && patriciaTravel) {
      correctionRows.push({
        spaceId: ctx.enterpriseSpace.id,
        transactionId: patriciaTxns[1].id,
        originalCategoryId: patriciaOps.id,
        correctedCategoryId: patriciaTravel.id,
        merchantPattern: 'uber business',
        descriptionPattern: 'uber business travel',
        confidence: 0.72,
        createdBy: ctx.adminUser.id,
        appliedToFuture: true,
      });
    }
  }

  if (correctionRows.length > 0) {
    await prisma.categoryCorrection.createMany({ data: correctionRows });
  }

  console.log(`  ✓ Created ${correctionRows.length} category corrections`);
}
