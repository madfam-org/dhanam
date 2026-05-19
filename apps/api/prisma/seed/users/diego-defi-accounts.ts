import { PrismaClient, Currency, Provider } from '../../../generated/prisma';

type SpaceRef = { id: string };

interface DiegoDefiAccountSeedSpaces {
  diegoSpace: SpaceRef;
  guestSpace: SpaceRef;
  mariaSpace: SpaceRef;
  carlosBusiness: SpaceRef;
  enterpriseSpace: SpaceRef;
}

export async function seedDiegoDefiAccounts(
  prisma: PrismaClient,
  {
    diegoSpace,
    guestSpace,
    mariaSpace,
    carlosBusiness,
    enterpriseSpace,
  }: DiegoDefiAccountSeedSpaces
) {
  // Add Diego's DeFi/Web3 accounts (separate creates for ID capture)
  const [
    diegoDefiEth,
    diegoDefiPolygon,
    diegoSandboxLand,
    diegoDaoGov,
    _diegoAxie,
    _diegoIlluvium,
    _diegoStarAtlas,
    _diegoGala,
    diegoBtcWallet,
    diegoDecentraland,
    diegoYgg,
    diegoDefiArbitrum,
    diegoDefiBase,
  ] = await Promise.all([
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-defi-ethereum',
        name: 'Ethereum DeFi Wallet',
        type: 'crypto',
        subtype: 'defi',
        currency: Currency.USD,
        balance: 28500,
        metadata: {
          network: 'ethereum',
          protocols: ['uniswap', 'aave', 'curve', 'lido'],
          positions: {
            uniswap: { type: 'lp', pool: 'ETH/USDC', shareUsd: 8200 },
            aave: { type: 'lending', supplied: 'ETH', supplyUsd: 9500, apy: 3.2 },
            curve: { type: 'lp', pool: '3pool', shareUsd: 5800 },
            lido: { type: 'staking', staked: '2.1 ETH', stETHUsd: 5000, apy: 3.8 },
          },
        },
        lastSyncedAt: new Date(),
      },
    }),
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-defi-polygon',
        name: 'Polygon DeFi Wallet',
        type: 'crypto',
        subtype: 'defi',
        currency: Currency.USD,
        balance: 6200,
        metadata: {
          network: 'polygon',
          protocols: ['quickswap', 'aave-polygon'],
          positions: {
            quickswap: { type: 'lp', pool: 'MATIC/USDC', shareUsd: 3200 },
            aavePolygon: { type: 'lending', supplied: 'USDC', supplyUsd: 3000, apy: 4.1 },
          },
        },
        lastSyncedAt: new Date(),
      },
    }),
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.manual,
        providerAccountId: 'diego-sandbox-land',
        name: 'Sandbox LAND Portfolio',
        type: 'crypto',
        subtype: 'gaming',
        currency: Currency.USD,
        balance: 7800,
        metadata: {
          platform: 'The Sandbox',
          parcels: [
            { coordinates: '(-12, 45)', size: '3x3', acquiredDate: '2022-01-15' },
            { coordinates: '(8, -22)', size: '1x1', acquiredDate: '2022-06-10' },
            { coordinates: '(31, 17)', size: '1x1', acquiredDate: '2023-03-01' },
          ],
          stakedSAND: 15000,
          stakingApy: 8.5,
        },
        lastSyncedAt: new Date(),
      },
    }),
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-dao-governance',
        name: 'DAO Governance Tokens',
        type: 'crypto',
        subtype: 'wallet',
        currency: Currency.USD,
        balance: 9400,
        metadata: {
          tokens: {
            ENS: { balance: 120, delegatedTo: 'self', votingPower: 120, valueUsd: 2400 },
            UNI: { balance: 450, delegatedTo: 'self', votingPower: 450, valueUsd: 3600 },
            AAVE: {
              balance: 35,
              delegatedTo: 'aave-governance.eth',
              votingPower: 35,
              valueUsd: 3400,
            },
          },
          proposals_voted: 14,
          last_vote_date: '2025-12-15',
        },
        lastSyncedAt: new Date(),
      },
    }),
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-axie-wallet',
        name: 'Axie Infinity Wallet',
        type: 'crypto',
        subtype: 'gaming',
        currency: Currency.USD,
        balance: 4850,
        metadata: {
          platform: 'Axie Infinity',
          chain: 'ronin',
          tokens: { AXS: { balance: 320, valueUsd: 2240 }, SLP: { balance: 85000, valueUsd: 255 } },
          stakingDetails: { token: 'AXS', amount: 200, apy: 42 },
          guild: { name: 'Ronin Raiders', role: 'manager', scholars: 5, revShare: 30 },
          nftInventory: [
            { name: 'Axie #12451 (Aqua)', value: 120 },
            { name: 'Axie #8923 (Plant)', value: 85 },
            { name: 'Axie #31020 (Beast)', value: 750 },
          ],
        },
        lastSyncedAt: new Date(),
      },
    }),
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-illuvium-staking',
        name: 'Illuvium Staking',
        type: 'crypto',
        subtype: 'gaming',
        currency: Currency.USD,
        balance: 6200,
        metadata: {
          platform: 'Illuvium',
          chain: 'immutable-zkevm',
          tokens: { ILV: { balance: 45, valueUsd: 3150 } },
          stakingDetails: { token: 'ILV', amount: 30, apy: 18, rewardToken: 'sILV' },
          land: { tier: 'Tier 3', valueUsd: 950 },
        },
        lastSyncedAt: new Date(),
      },
    }),
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-star-atlas-fleet',
        name: 'Star Atlas Fleet',
        type: 'crypto',
        subtype: 'gaming',
        currency: Currency.USD,
        balance: 2800,
        metadata: {
          platform: 'Star Atlas',
          chain: 'solana',
          tokens: {
            ATLAS: { balance: 250000, valueUsd: 750 },
            POLIS: { balance: 1200, valueUsd: 480 },
          },
          stakingDetails: { token: 'POLIS', amount: 800, apy: 15 },
          nftInventory: [
            { name: 'Pearce X5 Fighter', value: 650 },
            { name: 'Opal Jet', value: 600 },
          ],
        },
        lastSyncedAt: new Date(),
      },
    }),
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-gala-node',
        name: 'Gala Node',
        type: 'crypto',
        subtype: 'gaming',
        currency: Currency.USD,
        balance: 3400,
        metadata: {
          platform: 'Gala Games',
          chain: 'galachain',
          tokens: { GALA: { balance: 120000, valueUsd: 2400 } },
          nodeRewards: { monthlyUsd: 150 },
          nftInventory: [{ name: 'Gala Node License', value: 600 }],
        },
        lastSyncedAt: new Date(),
      },
    }),
    // Diego BTC Wallet
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-btc-wallet',
        name: 'BTC Wallet',
        type: 'crypto',
        subtype: 'wallet',
        currency: Currency.USD,
        balance: 15000,
        metadata: {
          chain: 'bitcoin',
          holdings: { BTC: { balance: 0.25, valueUsd: 15000 } },
        },
        lastSyncedAt: new Date(),
      },
    }),
    // Diego Decentraland
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-decentraland',
        name: 'Decentraland Portfolio',
        type: 'crypto',
        subtype: 'gaming',
        currency: Currency.USD,
        balance: 3200,
        metadata: {
          platform: 'Decentraland',
          chain: 'ethereum',
          tokens: { MANA: { balance: 8000, valueUsd: 1600 } },
          land: [
            { coordinates: '(42, -18)', size: '1x1', district: 'Vegas City' },
            { coordinates: '(-5, 33)', size: '1x1', district: 'Dragon City' },
          ],
          wearables: { count: 12, totalValueUsd: 850 },
        },
        lastSyncedAt: new Date(),
      },
    }),
    // Diego YGG Position
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-ygg-position',
        name: 'YGG Guild Position',
        type: 'crypto',
        subtype: 'gaming',
        currency: Currency.USD,
        balance: 2100,
        metadata: {
          platform: 'Yield Guild Games',
          chain: 'ethereum',
          tokens: { YGG: { balance: 5000, valueUsd: 2100 } },
          guild: {
            name: 'YGG SEA',
            role: 'scholar',
            gamesPlayed: ['Axie Infinity', 'The Sandbox', 'Star Atlas'],
          },
        },
        lastSyncedAt: new Date(),
      },
    }),
    // Diego DeFi Arbitrum
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-defi-arbitrum',
        name: 'Arbitrum DeFi Wallet',
        type: 'crypto',
        subtype: 'defi',
        currency: Currency.USD,
        balance: 4500,
        metadata: {
          network: 'arbitrum',
          protocols: ['gmx', 'radiant'],
          positions: {
            gmx: { type: 'perpetual', pair: 'ETH/USD', sizeUsd: 2500, leverage: 2, pnl: 180 },
            radiant: { type: 'lending', supplied: 'USDC', supplyUsd: 2000, apy: 5.8 },
          },
        },
        lastSyncedAt: new Date(),
      },
    }),
    // Diego DeFi Base
    prisma.account.create({
      data: {
        spaceId: diegoSpace.id,
        provider: Provider.blockchain,
        providerAccountId: 'diego-defi-base',
        name: 'Base DeFi Wallet',
        type: 'crypto',
        subtype: 'defi',
        currency: Currency.USD,
        balance: 2800,
        metadata: {
          network: 'base',
          protocols: ['aerodrome', 'uniswap-base'],
          positions: {
            aerodrome: { type: 'lp', pool: 'ETH/USDC', shareUsd: 1800, apy: 12.5 },
            uniswapBase: { type: 'lp', pool: 'cbETH/WETH', shareUsd: 1000, apy: 4.2 },
          },
        },
        lastSyncedAt: new Date(),
      },
    }),
  ]);

  // Update Diego's ETH wallet metadata to include USDC and APE
  const diegoEthWallet = await prisma.account.findFirst({
    where: { spaceId: diegoSpace.id, providerAccountId: 'diego-eth-wallet' },
  });
  if (diegoEthWallet) {
    await prisma.account.update({
      where: { id: diegoEthWallet.id },
      data: {
        metadata: {
          ...(diegoEthWallet.metadata as object),
          holdings: {
            ETH: { balance: 3.5, valueUsd: 11200 },
            USDC: { balance: 5000, valueUsd: 5000 },
            APE: { balance: 200, valueUsd: 600 },
          },
        },
        balance: 16800,
      },
    });
  }

  // Add vesting metadata to Diego's DAO governance account
  await prisma.account.update({
    where: { id: diegoDaoGov.id },
    data: {
      metadata: {
        ...(diegoDaoGov.metadata as object),
        vesting: {
          UNI: {
            totalAmount: 100,
            vestedAmount: 50,
            vestingStart: '2023-01-01',
            vestingEnd: '2027-01-01',
            cliffDate: '2024-01-01',
            schedule: '25 tokens/year after cliff',
          },
        },
      },
    },
  });

  // Set creditLimit on credit accounts (not available in nested create)
  await Promise.all([
    prisma.account.updateMany({
      where: { spaceId: guestSpace.id, providerAccountId: 'guest-credit' },
      data: { creditLimit: 50000 },
    }),
    prisma.account.updateMany({
      where: { spaceId: mariaSpace.id, providerAccountId: 'maria-amex' },
      data: { creditLimit: 5000 },
    }),
    prisma.account.updateMany({
      where: { spaceId: carlosBusiness.id, providerAccountId: 'business-credit' },
      data: { creditLimit: 250000 },
    }),
    prisma.account.updateMany({
      where: { spaceId: enterpriseSpace.id, providerAccountId: 'enterprise-amex' },
      data: { creditLimit: 500000 },
    }),
  ]);

  return {
    diegoDefiEthAccountId: diegoDefiEth.id,
    diegoDefiPolygonAccountId: diegoDefiPolygon.id,
    diegoSandboxLandAccountId: diegoSandboxLand.id,
    diegoDaoGovernanceAccountId: diegoDaoGov.id,
    diegoBtcAccountId: diegoBtcWallet.id,
    diegoDecentralandAccountId: diegoDecentraland.id,
    diegoYggAccountId: diegoYgg.id,
    diegoDefiArbitrumAccountId: diegoDefiArbitrum.id,
    diegoDefiBaseAccountId: diegoDefiBase.id,
  };
}
