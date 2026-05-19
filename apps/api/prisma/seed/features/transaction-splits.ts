import { PrismaClient, Currency } from '../../../generated/prisma';
import { subDays } from 'date-fns';
import { SeedContext } from '../helpers';

export async function seedTransactionSplits(prisma: PrismaClient, ctx: SeedContext) {
  // 4. TRANSACTION SPLITS
  console.log('\n✂️ Creating transaction splits...');

  const carlosChecking = await prisma.account.findFirst({
    where: { spaceId: ctx.carlosPersonal.id, type: 'checking' },
  });

  if (carlosChecking) {
    const splitTransactions = [
      {
        description: 'Costco Groceries',
        amount: -4500,
        date: subDays(new Date(), 3),
        carlosPct: 50,
        patriciaPct: 50,
      },
      {
        description: 'CFE Electricity',
        amount: -2200,
        date: subDays(new Date(), 7),
        carlosPct: 50,
        patriciaPct: 50,
      },
      {
        description: 'Apartment Rent',
        amount: -25000,
        date: subDays(new Date(), 1),
        carlosPct: 60,
        patriciaPct: 40,
      },
      {
        description: 'Pujol Dinner',
        amount: -3800,
        date: subDays(new Date(), 10),
        carlosPct: 50,
        patriciaPct: 50,
      },
      {
        description: 'Cancún Vacation',
        amount: -45000,
        date: subDays(new Date(), 21),
        carlosPct: 60,
        patriciaPct: 40,
      },
      {
        description: 'IKEA Furniture',
        amount: -18000,
        date: subDays(new Date(), 14),
        carlosPct: 70,
        patriciaPct: 30,
      },
    ];

    for (const st of splitTransactions) {
      const txn = await prisma.transaction.create({
        data: {
          accountId: carlosChecking.id,
          amount: st.amount,
          currency: Currency.MXN,
          description: st.description,
          merchant: st.description.split(' ')[0],
          date: st.date,
          pending: false,
          isSplit: true,
        },
      });

      await prisma.transactionSplit.createMany({
        data: [
          {
            transactionId: txn.id,
            userId: ctx.carlosUser.id,
            amount: (st.amount * st.carlosPct) / 100,
            percentage: st.carlosPct,
            note: 'Carlos share',
          },
          {
            transactionId: txn.id,
            userId: ctx.adminUser.id,
            amount: (st.amount * st.patriciaPct) / 100,
            percentage: st.patriciaPct,
            note: 'Patricia share',
          },
        ],
      });
    }
  }

  console.log('  ✓ Created 6 split transactions with 12 splits');
}
