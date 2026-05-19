import { PrismaClient, Currency } from '../../../generated/prisma';
import { subDays } from 'date-fns';
import { SeedContext } from '../helpers';

export async function seedDefiTransactions(prisma: PrismaClient, ctx: SeedContext) {
  // 6. DEFI TRANSACTIONS (Diego)
  console.log('\n🔗 Generating DeFi transactions for Diego...');

  const diegoDefiEthAccount = ctx.diegoDefiEthAccountId
    ? await prisma.account.findUnique({ where: { id: ctx.diegoDefiEthAccountId } })
    : null;
  const diegoDefiPolyAccount = ctx.diegoDefiPolygonAccountId
    ? await prisma.account.findUnique({ where: { id: ctx.diegoDefiPolygonAccountId } })
    : null;
  const diegoDaoAccount = ctx.diegoDaoGovernanceAccountId
    ? await prisma.account.findUnique({ where: { id: ctx.diegoDaoGovernanceAccountId } })
    : null;
  const diegoSandboxAccount = ctx.diegoSandboxLandAccountId
    ? await prisma.account.findUnique({ where: { id: ctx.diegoSandboxLandAccountId } })
    : null;

  const defiTxns: Array<{
    accountId: string;
    amount: number;
    currency: Currency;
    description: string;
    merchant: string;
    date: Date;
    pending: boolean;
    metadata?: object;
  }> = [];

  if (diegoDefiEthAccount) {
    defiTxns.push(
      {
        accountId: diegoDefiEthAccount.id,
        amount: -2500,
        currency: Currency.USD,
        description: 'Uniswap V3: Swap ETH → USDC',
        merchant: 'Uniswap',
        date: subDays(new Date(), 45),
        pending: false,
        metadata: { protocol: 'uniswap', type: 'swap' },
      },
      {
        accountId: diegoDefiEthAccount.id,
        amount: -5000,
        currency: Currency.USD,
        description: 'Aave V3: Supply ETH',
        merchant: 'Aave',
        date: subDays(new Date(), 40),
        pending: false,
        metadata: { protocol: 'aave', type: 'supply' },
      },
      {
        accountId: diegoDefiEthAccount.id,
        amount: 120,
        currency: Currency.USD,
        description: 'Aave V3: Interest earned',
        merchant: 'Aave',
        date: subDays(new Date(), 5),
        pending: false,
        metadata: { protocol: 'aave', type: 'yield' },
      },
      {
        accountId: diegoDefiEthAccount.id,
        amount: -3000,
        currency: Currency.USD,
        description: 'Curve: Deposit to 3pool',
        merchant: 'Curve Finance',
        date: subDays(new Date(), 35),
        pending: false,
        metadata: { protocol: 'curve', type: 'lp_deposit' },
      },
      {
        accountId: diegoDefiEthAccount.id,
        amount: 85,
        currency: Currency.USD,
        description: 'Curve: CRV farming rewards',
        merchant: 'Curve Finance',
        date: subDays(new Date(), 7),
        pending: false,
        metadata: { protocol: 'curve', type: 'farming_reward' },
      },
      {
        accountId: diegoDefiEthAccount.id,
        amount: -4200,
        currency: Currency.USD,
        description: 'Lido: Stake 2.1 ETH → stETH',
        merchant: 'Lido',
        date: subDays(new Date(), 30),
        pending: false,
        metadata: { protocol: 'lido', type: 'stake' },
      },
      {
        accountId: diegoDefiEthAccount.id,
        amount: 45,
        currency: Currency.USD,
        description: 'Lido: stETH staking rewards',
        merchant: 'Lido',
        date: subDays(new Date(), 3),
        pending: false,
        metadata: { protocol: 'lido', type: 'staking_reward' },
      }
    );
  }

  if (diegoDefiPolyAccount) {
    defiTxns.push(
      {
        accountId: diegoDefiPolyAccount.id,
        amount: -2000,
        currency: Currency.USD,
        description: 'QuickSwap: Add MATIC/USDC liquidity',
        merchant: 'QuickSwap',
        date: subDays(new Date(), 25),
        pending: false,
        metadata: { protocol: 'quickswap', type: 'lp_deposit' },
      },
      {
        accountId: diegoDefiPolyAccount.id,
        amount: 65,
        currency: Currency.USD,
        description: 'QuickSwap: LP fees earned',
        merchant: 'QuickSwap',
        date: subDays(new Date(), 4),
        pending: false,
        metadata: { protocol: 'quickswap', type: 'lp_fees' },
      }
    );
  }

  if (diegoDaoAccount) {
    defiTxns.push(
      {
        accountId: diegoDaoAccount.id,
        amount: -12,
        currency: Currency.USD,
        description: 'ENS DAO: Vote gas fee (Proposal #42)',
        merchant: 'ENS DAO',
        date: subDays(new Date(), 20),
        pending: false,
        metadata: { protocol: 'ens', type: 'governance_vote' },
      },
      {
        accountId: diegoDaoAccount.id,
        amount: -8,
        currency: Currency.USD,
        description: 'Uniswap Gov: Vote gas fee (Proposal #18)',
        merchant: 'Uniswap Governance',
        date: subDays(new Date(), 15),
        pending: false,
        metadata: { protocol: 'uniswap', type: 'governance_vote' },
      },
      {
        accountId: diegoDaoAccount.id,
        amount: -15,
        currency: Currency.USD,
        description: 'Aave Gov: Delegate voting power',
        merchant: 'Aave Governance',
        date: subDays(new Date(), 50),
        pending: false,
        metadata: { protocol: 'aave', type: 'delegate' },
      }
    );
  }

  if (diegoSandboxAccount) {
    defiTxns.push(
      {
        accountId: diegoSandboxAccount.id,
        amount: 320,
        currency: Currency.USD,
        description: 'Sandbox: SAND staking rewards',
        merchant: 'The Sandbox',
        date: subDays(new Date(), 10),
        pending: false,
        metadata: { protocol: 'sandbox', type: 'staking_reward' },
      },
      {
        accountId: diegoSandboxAccount.id,
        amount: 1200,
        currency: Currency.USD,
        description: 'Sandbox: Marketplace LAND sale',
        merchant: 'The Sandbox',
        date: subDays(new Date(), 60),
        pending: false,
        metadata: { protocol: 'sandbox', type: 'nft_sale' },
      },
      {
        accountId: diegoSandboxAccount.id,
        amount: -800,
        currency: Currency.USD,
        description: 'Sandbox: Purchase 1x1 LAND parcel',
        merchant: 'The Sandbox',
        date: subDays(new Date(), 90),
        pending: false,
        metadata: { protocol: 'sandbox', type: 'nft_purchase' },
      }
    );
  }

  // L2 DeFi transactions (Arbitrum & Base)
  const diegoDefiArbAccount = ctx.diegoDefiArbitrumAccountId
    ? await prisma.account.findUnique({ where: { id: ctx.diegoDefiArbitrumAccountId } })
    : null;
  const diegoDefiBaseAccount = ctx.diegoDefiBaseAccountId
    ? await prisma.account.findUnique({ where: { id: ctx.diegoDefiBaseAccountId } })
    : null;
  const diegoDecentralandAccount = ctx.diegoDecentralandAccountId
    ? await prisma.account.findUnique({ where: { id: ctx.diegoDecentralandAccountId } })
    : null;
  const diegoBtcAccount = ctx.diegoBtcAccountId
    ? await prisma.account.findUnique({ where: { id: ctx.diegoBtcAccountId } })
    : null;

  if (diegoDefiArbAccount) {
    defiTxns.push(
      {
        accountId: diegoDefiArbAccount.id,
        amount: -2500,
        currency: Currency.USD,
        description: 'GMX: Open ETH/USD Long 2x',
        merchant: 'GMX',
        date: subDays(new Date(), 20),
        pending: false,
        metadata: { protocol: 'gmx', type: 'perpetual_open', leverage: 2 },
      },
      {
        accountId: diegoDefiArbAccount.id,
        amount: 180,
        currency: Currency.USD,
        description: 'GMX: Unrealized PnL ETH/USD',
        merchant: 'GMX',
        date: subDays(new Date(), 2),
        pending: false,
        metadata: { protocol: 'gmx', type: 'pnl' },
      },
      {
        accountId: diegoDefiArbAccount.id,
        amount: -2000,
        currency: Currency.USD,
        description: 'Radiant: Supply USDC',
        merchant: 'Radiant Capital',
        date: subDays(new Date(), 18),
        pending: false,
        metadata: { protocol: 'radiant', type: 'supply' },
      },
      {
        accountId: diegoDefiArbAccount.id,
        amount: 32,
        currency: Currency.USD,
        description: 'Radiant: USDC lending interest',
        merchant: 'Radiant Capital',
        date: subDays(new Date(), 1),
        pending: false,
        metadata: { protocol: 'radiant', type: 'yield' },
      },
      {
        accountId: diegoDefiArbAccount.id,
        amount: -15,
        currency: Currency.USD,
        description: 'Arbitrum: Bridge from ETH mainnet',
        merchant: 'Arbitrum Bridge',
        date: subDays(new Date(), 22),
        pending: false,
        metadata: { type: 'bridge', from: 'ethereum', to: 'arbitrum' },
      }
    );
  }

  if (diegoDefiBaseAccount) {
    defiTxns.push(
      {
        accountId: diegoDefiBaseAccount.id,
        amount: -1800,
        currency: Currency.USD,
        description: 'Aerodrome: Add ETH/USDC LP',
        merchant: 'Aerodrome',
        date: subDays(new Date(), 15),
        pending: false,
        metadata: { protocol: 'aerodrome', type: 'lp_deposit' },
      },
      {
        accountId: diegoDefiBaseAccount.id,
        amount: 45,
        currency: Currency.USD,
        description: 'Aerodrome: LP rewards (AERO)',
        merchant: 'Aerodrome',
        date: subDays(new Date(), 2),
        pending: false,
        metadata: { protocol: 'aerodrome', type: 'farming_reward' },
      },
      {
        accountId: diegoDefiBaseAccount.id,
        amount: -1000,
        currency: Currency.USD,
        description: 'Uniswap Base: Add cbETH/WETH LP',
        merchant: 'Uniswap',
        date: subDays(new Date(), 12),
        pending: false,
        metadata: { protocol: 'uniswap-base', type: 'lp_deposit' },
      },
      {
        accountId: diegoDefiBaseAccount.id,
        amount: 12,
        currency: Currency.USD,
        description: 'Uniswap Base: LP fees earned',
        merchant: 'Uniswap',
        date: subDays(new Date(), 1),
        pending: false,
        metadata: { protocol: 'uniswap-base', type: 'lp_fees' },
      },
      {
        accountId: diegoDefiBaseAccount.id,
        amount: -8,
        currency: Currency.USD,
        description: 'Base: Bridge from ETH mainnet',
        merchant: 'Base Bridge',
        date: subDays(new Date(), 16),
        pending: false,
        metadata: { type: 'bridge', from: 'ethereum', to: 'base' },
      }
    );
  }

  // NFT Royalty income
  if (diegoSandboxAccount) {
    defiTxns.push({
      accountId: diegoSandboxAccount.id,
      amount: 45,
      currency: Currency.USD,
      description: 'Sandbox: Marketplace royalty payment',
      merchant: 'The Sandbox',
      date: subDays(new Date(), 8),
      pending: false,
      metadata: { protocol: 'sandbox', type: 'royalty' },
    });
  }
  if (diegoDefiEthAccount) {
    defiTxns.push({
      accountId: diegoDefiEthAccount.id,
      amount: 120,
      currency: Currency.USD,
      description: 'OpenSea: Creator royalty (BAYC derivative)',
      merchant: 'OpenSea',
      date: subDays(new Date(), 12),
      pending: false,
      metadata: { protocol: 'opensea', type: 'royalty', collection: 'BAYC Derivatives' },
    });
  }
  if (diegoDecentralandAccount) {
    defiTxns.push({
      accountId: diegoDecentralandAccount.id,
      amount: 85,
      currency: Currency.USD,
      description: 'Decentraland: Wearable sale',
      merchant: 'Decentraland Marketplace',
      date: subDays(new Date(), 6),
      pending: false,
      metadata: { protocol: 'decentraland', type: 'nft_sale', item: 'Rare Cyberpunk Jacket' },
    });
  }

  // Cross-chain bridge transactions
  if (diegoDefiEthAccount && diegoDefiArbAccount) {
    defiTxns.push({
      accountId: diegoDefiEthAccount.id,
      amount: -1000,
      currency: Currency.USD,
      description: 'Bridge: ETH → Arbitrum (1000 USDC)',
      merchant: 'Arbitrum Bridge',
      date: subDays(new Date(), 22),
      pending: false,
      metadata: { type: 'bridge_out', destination: 'arbitrum', amount: 1000, token: 'USDC' },
    });
  }
  if (diegoDefiEthAccount && diegoDefiBaseAccount) {
    defiTxns.push({
      accountId: diegoDefiEthAccount.id,
      amount: -500,
      currency: Currency.USD,
      description: 'Bridge: ETH → Base (0.25 ETH)',
      merchant: 'Base Bridge',
      date: subDays(new Date(), 16),
      pending: false,
      metadata: { type: 'bridge_out', destination: 'base', amount: 0.25, token: 'ETH' },
    });
  }

  if (defiTxns.length > 0) {
    await prisma.transaction.createMany({ data: defiTxns });
    console.log(`  ✓ Created ${defiTxns.length} DeFi/L2/bridge transactions for Diego`);
  }
}
