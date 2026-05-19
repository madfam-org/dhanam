import { Currency, SpaceType } from '../../generated/prisma';

// Helper to generate realistic transaction amounts
export const randomAmount = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min);

// Helper to generate dates within a range
export const randomDate = (start: Date, end: Date) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

// Transaction templates for realistic data (includes LATAM merchants)
export const transactionTemplates = {
  income: [
    { name: 'Salary', category: 'Salary', range: [45000, 85000] as const },
    { name: 'Freelance Payment', category: 'Freelance', range: [5000, 25000] as const },
    { name: 'Investment Returns', category: 'Investment', range: [1000, 10000] as const },
    { name: 'Rental Income', category: 'Rental', range: [8000, 15000] as const },
  ],
  expenses: {
    personal: [
      { name: 'Oxxo', category: 'Groceries', range: [150, 500] as const },
      { name: 'Soriana', category: 'Groceries', range: [1200, 3500] as const },
      { name: 'Netflix MX', category: 'Entertainment', range: [149, 299] as const },
      { name: 'Spotify MX', category: 'Entertainment', range: [115, 169] as const },
      { name: 'CFE', category: 'Utilities', range: [500, 2500] as const },
      { name: 'Telmex', category: 'Utilities', range: [599, 1299] as const },
      { name: 'Pemex', category: 'Transportation', range: [500, 1500] as const },
      { name: 'Uber', category: 'Transportation', range: [80, 350] as const },
      { name: 'Cabify', category: 'Transportation', range: [90, 320] as const },
      { name: 'Starbucks', category: 'Food & Dining', range: [85, 180] as const },
      { name: 'Restaurant', category: 'Food & Dining', range: [350, 1500] as const },
      { name: 'Rappi', category: 'Food & Dining', range: [150, 650] as const },
      { name: 'Uber Eats MX', category: 'Food & Dining', range: [120, 500] as const },
      { name: 'Amazon MX', category: 'Shopping', range: [299, 2500] as const },
      { name: 'Liverpool', category: 'Shopping', range: [1500, 8000] as const },
      { name: 'MercadoLibre', category: 'Shopping', range: [200, 5000] as const },
      { name: 'Coppel', category: 'Shopping', range: [500, 4000] as const },
      { name: 'Walmart', category: 'Groceries', range: [800, 4000] as const },
      { name: 'Costco', category: 'Groceries', range: [2000, 6000] as const },
      { name: "Sam's Club", category: 'Groceries', range: [1500, 5000] as const },
      { name: 'Bodega Aurrera', category: 'Groceries', range: [400, 2500] as const },
      { name: 'La Comer', category: 'Groceries', range: [600, 3000] as const },
      { name: 'Cinepolis', category: 'Entertainment', range: [180, 600] as const },
      { name: 'Disney+', category: 'Entertainment', range: [159, 219] as const },
      { name: 'HBO Max', category: 'Entertainment', range: [149, 199] as const },
      { name: 'Totalplay', category: 'Utilities', range: [699, 1299] as const },
      { name: 'Izzi', category: 'Utilities', range: [499, 999] as const },
      { name: 'DiDi', category: 'Transportation', range: [60, 300] as const },
      { name: 'OXXO Gas', category: 'Transportation', range: [600, 1800] as const },
      { name: 'Farmacias del Ahorro', category: 'Shopping', range: [150, 1200] as const },
      { name: 'Farmacia Guadalajara', category: 'Shopping', range: [100, 800] as const },
      { name: 'VIPs', category: 'Food & Dining', range: [250, 800] as const },
      { name: 'Sanborns', category: 'Food & Dining', range: [200, 900] as const },
      { name: 'Dominos', category: 'Food & Dining', range: [150, 450] as const },
    ],
    business: [
      { name: 'Office Rent', category: 'Rent', range: [15000, 35000] as const },
      { name: 'Payroll', category: 'Payroll', range: [50000, 150000] as const },
      { name: 'Software Licenses', category: 'Software', range: [2000, 10000] as const },
      { name: 'Marketing Ads', category: 'Marketing', range: [5000, 25000] as const },
      { name: 'Office Supplies', category: 'Supplies', range: [1000, 5000] as const },
      { name: 'Professional Services', category: 'Services', range: [8000, 30000] as const },
    ],
  },
};

// Comprehensive ESG data for varied crypto assets
export const cryptoESGData = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    env: 35,
    social: 65,
    gov: 70,
    notes: 'Proof-of-work consensus - significant energy footprint',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    env: 75,
    social: 80,
    gov: 85,
    notes: 'Proof-of-stake since 2022 - 99.95% energy reduction',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    env: 82,
    social: 72,
    gov: 65,
    notes: 'High throughput with low energy - some centralization concerns',
  },
  {
    symbol: 'ADA',
    name: 'Cardano',
    env: 88,
    social: 85,
    gov: 90,
    notes: 'Peer-reviewed development, proof-of-stake, academic approach',
  },
  {
    symbol: 'XRP',
    name: 'XRP',
    env: 85,
    social: 60,
    gov: 55,
    notes: 'Energy efficient but facing regulatory scrutiny',
  },
  {
    symbol: 'DOT',
    name: 'Polkadot',
    env: 80,
    social: 78,
    gov: 88,
    notes: 'On-chain governance, parachain architecture',
  },
  {
    symbol: 'AVAX',
    name: 'Avalanche',
    env: 84,
    social: 75,
    gov: 82,
    notes: 'Subnets allow for efficient scaling',
  },
  {
    symbol: 'AAVE',
    name: 'Aave',
    env: 76,
    social: 82,
    gov: 90,
    notes: 'DeFi lending protocol with strong governance',
  },
  {
    symbol: 'UNI',
    name: 'Uniswap',
    env: 74,
    social: 78,
    gov: 88,
    notes: 'Leading DEX with decentralized governance',
  },
  {
    symbol: 'CRV',
    name: 'Curve',
    env: 72,
    social: 70,
    gov: 85,
    notes: 'Stablecoin DEX with veCRV governance model',
  },
  {
    symbol: 'LIDO',
    name: 'Lido',
    env: 78,
    social: 76,
    gov: 72,
    notes: 'Liquid staking protocol - some centralization concerns',
  },
  {
    symbol: 'SAND',
    name: 'The Sandbox',
    env: 45,
    social: 72,
    gov: 58,
    notes: 'Ethereum L1 - moderate energy impact from gaming',
  },
  {
    symbol: 'MANA',
    name: 'Decentraland',
    env: 42,
    social: 68,
    gov: 55,
    notes: 'Ethereum-based virtual world with DAO governance',
  },
  {
    symbol: 'OP',
    name: 'Optimism',
    env: 82,
    social: 80,
    gov: 86,
    notes: 'L2 rollup with retroactive public goods funding',
  },
  {
    symbol: 'ARB',
    name: 'Arbitrum',
    env: 81,
    social: 77,
    gov: 83,
    notes: 'L2 rollup with DAO governance and grants program',
  },
  {
    symbol: 'AXS',
    name: 'Axie Infinity',
    env: 50,
    social: 78,
    gov: 62,
    notes: 'Play-to-earn gaming on Ronin sidechain',
  },
  {
    symbol: 'SLP',
    name: 'Smooth Love Potion',
    env: 48,
    social: 65,
    gov: 40,
    notes: 'In-game reward token with high inflation',
  },
  {
    symbol: 'GALA',
    name: 'Gala Games',
    env: 55,
    social: 70,
    gov: 58,
    notes: 'Gaming ecosystem with node-based distribution',
  },
  {
    symbol: 'ILV',
    name: 'Illuvium',
    env: 60,
    social: 74,
    gov: 68,
    notes: 'AAA gaming on Immutable zkEVM',
  },
  {
    symbol: 'IMX',
    name: 'Immutable X',
    env: 78,
    social: 76,
    gov: 72,
    notes: 'L2 for NFTs with zero gas fees',
  },
  {
    symbol: 'ENJ',
    name: 'Enjin',
    env: 62,
    social: 72,
    gov: 65,
    notes: 'NFT minting and gaming infrastructure',
  },
  {
    symbol: 'ATLAS',
    name: 'Star Atlas',
    env: 58,
    social: 68,
    gov: 55,
    notes: 'Solana-based space exploration metaverse',
  },
  {
    symbol: 'POLIS',
    name: 'Star Atlas DAO',
    env: 58,
    social: 70,
    gov: 72,
    notes: 'Governance token for Star Atlas DAO',
  },
  {
    symbol: 'APE',
    name: 'ApeCoin',
    env: 44,
    social: 82,
    gov: 60,
    notes: 'BAYC ecosystem governance and utility token',
  },
  {
    symbol: 'YGG',
    name: 'Yield Guild Games',
    env: 52,
    social: 80,
    gov: 70,
    notes: 'Gaming guild DAO with scholarship programs',
  },
  {
    symbol: 'RON',
    name: 'Ronin',
    env: 56,
    social: 74,
    gov: 60,
    notes: 'Axie Infinity sidechain - improved after bridge hack',
  },
];

export interface SeedContext {
  guestUser: { id: string };
  mariaUser: { id: string };
  carlosUser: { id: string };
  adminUser: { id: string };
  platformAdmin: { id: string };
  diegoUser: { id: string };

  guestSpace: { id: string; type: SpaceType };
  mariaSpace: { id: string; type: SpaceType };
  carlosPersonal: { id: string; type: SpaceType };
  carlosBusiness: { id: string; type: SpaceType };
  enterpriseSpace: { id: string; type: SpaceType };
  diegoSpace: { id: string; type: SpaceType };

  // Diego's DeFi/Web3 account IDs (populated after user creation)
  diegoDefiEthAccountId?: string;
  diegoDefiPolygonAccountId?: string;
  diegoSandboxLandAccountId?: string;
  diegoDaoGovernanceAccountId?: string;
  diegoBtcAccountId?: string;
  diegoDecentralandAccountId?: string;
  diegoYggAccountId?: string;
  diegoDefiArbitrumAccountId?: string;
  diegoDefiBaseAccountId?: string;
}
