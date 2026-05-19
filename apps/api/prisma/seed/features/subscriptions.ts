import { PrismaClient, AccountOwnership, Currency } from '../../../generated/prisma';
import { addDays, subDays } from 'date-fns';
import { SeedContext } from '../helpers';

export async function seedSubscriptions(prisma: PrismaClient, ctx: SeedContext) {
  // 3. SUBSCRIPTIONS (batch)
  console.log('\n📺 Creating subscriptions...');

  await prisma.subscription.createMany({
    data: [
      {
        spaceId: ctx.mariaSpace.id,
        serviceName: 'Netflix',
        category: 'streaming',
        amount: 199,
        currency: Currency.MXN,
        billingCycle: 'monthly',
        status: 'active',
        startDate: subDays(new Date(), Math.floor(Math.random() * 365) + 30),
        nextBillingDate: addDays(new Date(), Math.floor(Math.random() * 28) + 1),
        lastBillingDate: subDays(new Date(), Math.floor(Math.random() * 28)),
        annualCost: 2388,
        usageFrequency: 'high',
      },
      {
        spaceId: ctx.mariaSpace.id,
        serviceName: 'Spotify Family',
        category: 'music',
        amount: 269,
        currency: Currency.MXN,
        billingCycle: 'monthly',
        status: 'active',
        startDate: subDays(new Date(), Math.floor(Math.random() * 365) + 30),
        nextBillingDate: addDays(new Date(), Math.floor(Math.random() * 28) + 1),
        lastBillingDate: subDays(new Date(), Math.floor(Math.random() * 28)),
        annualCost: 3228,
        usageFrequency: 'high',
      },
      {
        spaceId: ctx.mariaSpace.id,
        serviceName: 'iCloud+ 200GB',
        category: 'cloud_storage',
        amount: 49,
        currency: Currency.MXN,
        billingCycle: 'monthly',
        status: 'active',
        startDate: subDays(new Date(), Math.floor(Math.random() * 365) + 30),
        nextBillingDate: addDays(new Date(), Math.floor(Math.random() * 28) + 1),
        lastBillingDate: subDays(new Date(), Math.floor(Math.random() * 28)),
        annualCost: 588,
        usageFrequency: 'medium',
      },
      {
        spaceId: ctx.carlosPersonal.id,
        serviceName: 'ChatGPT Plus',
        category: 'software',
        amount: 20,
        currency: Currency.USD,
        billingCycle: 'monthly',
        status: 'active',
        startDate: subDays(new Date(), Math.floor(Math.random() * 365) + 30),
        nextBillingDate: addDays(new Date(), Math.floor(Math.random() * 28) + 1),
        lastBillingDate: subDays(new Date(), Math.floor(Math.random() * 28)),
        annualCost: 240,
        usageFrequency: 'high',
      },
      {
        spaceId: ctx.carlosPersonal.id,
        serviceName: 'Adobe Creative Cloud',
        category: 'software',
        amount: 55,
        currency: Currency.USD,
        billingCycle: 'monthly',
        status: 'active',
        startDate: subDays(new Date(), Math.floor(Math.random() * 365) + 30),
        nextBillingDate: addDays(new Date(), Math.floor(Math.random() * 28) + 1),
        lastBillingDate: subDays(new Date(), Math.floor(Math.random() * 28)),
        annualCost: 660,
        usageFrequency: 'medium',
        savingsRecommendation: 'Consider annual plan ($53/mo saves $24/yr)',
      },
      {
        spaceId: ctx.carlosPersonal.id,
        serviceName: 'Gym - Sports World',
        category: 'fitness',
        amount: 1299,
        currency: Currency.MXN,
        billingCycle: 'monthly',
        status: 'active',
        startDate: subDays(new Date(), Math.floor(Math.random() * 365) + 30),
        nextBillingDate: addDays(new Date(), Math.floor(Math.random() * 28) + 1),
        lastBillingDate: subDays(new Date(), Math.floor(Math.random() * 28)),
        annualCost: 15588,
        usageFrequency: 'low',
        savingsRecommendation: 'Usage is low (2x/month). Consider downgrading or cancelling.',
      },
      {
        spaceId: ctx.diegoSpace.id,
        serviceName: 'AWS',
        category: 'software',
        amount: 85,
        currency: Currency.USD,
        billingCycle: 'monthly',
        status: 'active',
        startDate: subDays(new Date(), Math.floor(Math.random() * 365) + 30),
        nextBillingDate: addDays(new Date(), Math.floor(Math.random() * 28) + 1),
        lastBillingDate: subDays(new Date(), Math.floor(Math.random() * 28)),
        annualCost: 1020,
        usageFrequency: 'high',
        alternativeServices: [
          { name: 'DigitalOcean', price: 48, url: 'https://digitalocean.com' },
          { name: 'Hetzner', price: 35, url: 'https://hetzner.com' },
        ],
      },
      {
        spaceId: ctx.diegoSpace.id,
        serviceName: 'Xbox Game Pass Ultimate',
        category: 'gaming',
        amount: 299,
        currency: Currency.MXN,
        billingCycle: 'monthly',
        status: 'active',
        startDate: subDays(new Date(), Math.floor(Math.random() * 365) + 30),
        nextBillingDate: addDays(new Date(), Math.floor(Math.random() * 28) + 1),
        lastBillingDate: subDays(new Date(), Math.floor(Math.random() * 28)),
        annualCost: 3588,
        usageFrequency: 'medium',
      },
    ],
  });

  console.log('  ✓ Created 8 active subscriptions');

  // 3b. CANCELLED & PAUSED SUBSCRIPTIONS (lifecycle demo)
  await prisma.subscription.createMany({
    data: [
      {
        spaceId: ctx.mariaSpace.id,
        serviceName: 'Gym - Sports World',
        category: 'fitness',
        amount: 1299,
        currency: Currency.MXN,
        billingCycle: 'monthly',
        status: 'cancelled',
        startDate: subDays(new Date(), 240),
        endDate: subDays(new Date(), 15),
        cancelledAt: subDays(new Date(), 15),
        cancellationReason: 'Switched to outdoor running and home workouts',
        annualCost: 15588,
        usageFrequency: 'low',
        lastBillingDate: subDays(new Date(), 45),
      },
      {
        spaceId: ctx.diegoSpace.id,
        serviceName: 'Discord Nitro',
        category: 'software',
        amount: 10,
        currency: Currency.USD,
        billingCycle: 'monthly',
        status: 'paused',
        startDate: subDays(new Date(), 180),
        annualCost: 120,
        usageFrequency: 'low',
        lastBillingDate: subDays(new Date(), 30),
        savingsRecommendation: 'Usage dropped to low — paused to evaluate need',
      },
    ],
  });

  console.log('  ✓ Created 2 cancelled/paused subscriptions');

  // 3c. JOINT ACCOUNT OWNERSHIP (Carlos + Patricia household)
  const carlosJointChecking = await prisma.account.findFirst({
    where: { spaceId: ctx.carlosPersonal.id, type: 'checking' },
  });
  if (carlosJointChecking) {
    await prisma.account.update({
      where: { id: carlosJointChecking.id },
      data: { ownership: AccountOwnership.joint },
    });
    console.log('  ✓ Updated Carlos checking to joint ownership');
  }

  // Set Patricia's Vanguard Investment to trust ownership
  const patriciaVanguard = await prisma.account.findFirst({
    where: { spaceId: ctx.enterpriseSpace.id, providerAccountId: 'enterprise-investment' },
  });
  if (patriciaVanguard) {
    await prisma.account.update({
      where: { id: patriciaVanguard.id },
      data: { ownership: AccountOwnership.trust },
    });
    console.log('  ✓ Updated Patricia Vanguard to trust ownership');
  }
}
