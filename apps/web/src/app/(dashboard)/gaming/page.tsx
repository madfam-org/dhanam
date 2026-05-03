'use client';

import { Currency, useTranslation, CHART_COLORS } from '@dhanam/shared';
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Button } from '@dhanam/ui';
import { useQuery } from '@tanstack/react-query';
import { Gamepad2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CrossChainView } from '@/components/gaming/cross-chain-view';
import { EarningsByPlatform } from '@/components/gaming/earnings-by-platform';
import { GovernanceActivity } from '@/components/gaming/governance-activity';
import { GuildTracker } from '@/components/gaming/guild-tracker';
import { LandPortfolio } from '@/components/gaming/land-portfolio';
import { MultiPlatformOverview } from '@/components/gaming/multi-platform-overview';
import { NftGallery } from '@/components/gaming/nft-gallery';
import { PlatformSelector, type MetaversePlatform } from '@/components/gaming/platform-selector';
import { gamingApi } from '@/lib/api/gaming';
import { useSpaceStore } from '@/stores/space';
import { useAuth } from '~/lib/hooks/use-auth';
import { formatCurrency } from '~/lib/utils';

// Fallback data for development mode (used for Diego + Guest only)
const FALLBACK_PLATFORM_DATA = [
  {
    platform: 'sandbox',
    label: 'The Sandbox',
    chain: 'polygon',
    totalValueUsd: 14550,
    tokensCount: 1,
    stakingValueUsd: 6750,
    stakingApy: 8.5,
    landCount: 3,
    nftCount: 0,
    monthlyEarningsUsd: 503,
  },
  {
    platform: 'axie',
    label: 'Axie Infinity',
    chain: 'ronin',
    totalValueUsd: 4850,
    tokensCount: 2,
    stakingValueUsd: 1400,
    stakingApy: 42,
    landCount: 0,
    nftCount: 3,
    monthlyEarningsUsd: 284,
  },
  {
    platform: 'illuvium',
    label: 'Illuvium',
    chain: 'immutable-zkevm',
    totalValueUsd: 6200,
    tokensCount: 1,
    stakingValueUsd: 2100,
    stakingApy: 18,
    landCount: 1,
    nftCount: 1,
    monthlyEarningsUsd: 180,
  },
  {
    platform: 'star-atlas',
    label: 'Star Atlas',
    chain: 'solana',
    totalValueUsd: 2800,
    tokensCount: 2,
    stakingValueUsd: 320,
    stakingApy: 15,
    landCount: 0,
    nftCount: 2,
    monthlyEarningsUsd: 29,
  },
  {
    platform: 'gala',
    label: 'Gala Games',
    chain: 'galachain',
    totalValueUsd: 3400,
    tokensCount: 1,
    stakingValueUsd: 0,
    landCount: 1,
    nftCount: 1,
    monthlyEarningsUsd: 190,
  },
  {
    platform: 'enjin',
    label: 'Enjin',
    chain: 'ethereum',
    totalValueUsd: 1850,
    tokensCount: 1,
    stakingValueUsd: 0,
    landCount: 0,
    nftCount: 2,
    monthlyEarningsUsd: 45,
  },
  {
    platform: 'immutable',
    label: 'Immutable',
    chain: 'immutable-zkevm',
    totalValueUsd: 2100,
    tokensCount: 1,
    stakingValueUsd: 1000,
    stakingApy: 12,
    landCount: 0,
    nftCount: 2,
    monthlyEarningsUsd: 75,
  },
];

const FALLBACK_EARNINGS_DATA = [
  { platform: 'sandbox', source: 'staking', amountUsd: 48, color: CHART_COLORS[0] },
  { platform: 'sandbox', source: 'rental', amountUsd: 135, color: CHART_COLORS[1] },
  { platform: 'sandbox', source: 'creator', amountUsd: 320, color: CHART_COLORS[2] },
  { platform: 'axie', source: 'scholarship', amountUsd: 200, color: CHART_COLORS[3] },
  { platform: 'axie', source: 'staking', amountUsd: 49, color: CHART_COLORS[4] },
  { platform: 'axie', source: 'p2e', amountUsd: 35, color: CHART_COLORS[5] },
  { platform: 'illuvium', source: 'staking', amountUsd: 32, color: CHART_COLORS[6] },
  { platform: 'illuvium', source: 'p2e', amountUsd: 148, color: CHART_COLORS[2] },
  { platform: 'star-atlas', source: 'staking', amountUsd: 4, color: CHART_COLORS[7] },
  { platform: 'star-atlas', source: 'p2e', amountUsd: 25, color: CHART_COLORS[8] },
  { platform: 'gala', source: 'node_rewards', amountUsd: 150, color: CHART_COLORS[9] },
  { platform: 'gala', source: 'p2e', amountUsd: 40, color: CHART_COLORS[10] },
  { platform: 'enjin', source: 'marketplace', amountUsd: 45, color: CHART_COLORS[5] },
  { platform: 'immutable', source: 'staking', amountUsd: 10, color: CHART_COLORS[11] },
  { platform: 'immutable', source: 'marketplace', amountUsd: 65, color: CHART_COLORS[12] },
];

const FALLBACK_GUILD_DATA = [
  {
    platform: 'axie',
    guildName: 'Ronin Raiders',
    role: 'manager' as const,
    scholarCount: 5,
    revenueSharePercent: 30,
    monthlyIncomeUsd: 200,
  },
];

const FALLBACK_CHAIN_DATA = [
  { chain: 'polygon', totalValueUsd: 14550, platformCount: 1, platforms: ['sandbox'] },
  {
    chain: 'immutable-zkevm',
    totalValueUsd: 8300,
    platformCount: 2,
    platforms: ['illuvium', 'immutable'],
  },
  { chain: 'ronin', totalValueUsd: 4850, platformCount: 1, platforms: ['axie'] },
  { chain: 'galachain', totalValueUsd: 3400, platformCount: 1, platforms: ['gala'] },
  { chain: 'solana', totalValueUsd: 2800, platformCount: 1, platforms: ['star-atlas'] },
  { chain: 'ethereum', totalValueUsd: 1850, platformCount: 1, platforms: ['enjin'] },
];

const FALLBACK_PARCELS = [
  {
    coordinates: '(-12, 45)',
    size: '3x3',
    acquiredDate: '2022-01-15',
    rentalStatus: 'rented' as const,
    monthlyRental: 150,
    platform: 'The Sandbox',
  },
  {
    coordinates: '(8, -22)',
    size: '1x1',
    acquiredDate: '2022-06-10',
    rentalStatus: 'rented' as const,
    monthlyRental: 150,
    platform: 'The Sandbox',
  },
  {
    coordinates: '(31, 17)',
    size: '1x1',
    acquiredDate: '2023-03-01',
    rentalStatus: 'vacant' as const,
    platform: 'The Sandbox',
  },
  { tier: 'Tier 3', rentalStatus: 'self-use' as const, platform: 'Illuvium' },
  { rentalStatus: 'self-use' as const, platform: 'Gala Games' },
];

const FALLBACK_NFTS = [
  {
    name: 'BAYC #7291',
    collection: 'Bored Ape Yacht Club',
    currentValue: 18500,
    acquisitionCost: 32000,
  },
  {
    name: 'Decentraland Wearables',
    collection: 'Decentraland',
    currentValue: 850,
    acquisitionCost: 1200,
  },
  { name: 'diegonavarro.eth', collection: 'ENS', currentValue: 3200, acquisitionCost: 800 },
  {
    name: 'Axie #12451 (Aqua)',
    collection: 'Axie Infinity',
    currentValue: 120,
    acquisitionCost: 250,
    platform: 'Axie',
    chain: 'ronin',
  },
  {
    name: 'Axie #31020 (Beast)',
    collection: 'Axie Infinity',
    currentValue: 750,
    acquisitionCost: 400,
    platform: 'Axie',
    chain: 'ronin',
  },
  {
    name: 'Illuvial #2847',
    collection: 'Illuvium',
    currentValue: 280,
    acquisitionCost: 150,
    platform: 'Illuvium',
    chain: 'immutable-zkevm',
  },
  {
    name: 'Pearce X5 Fighter',
    collection: 'Star Atlas Ships',
    currentValue: 650,
    acquisitionCost: 400,
    platform: 'Star Atlas',
    chain: 'solana',
  },
  {
    name: 'Gods Unchained Genesis',
    collection: 'Gods Unchained',
    currentValue: 450,
    acquisitionCost: 200,
    platform: 'Immutable',
    chain: 'immutable-zkevm',
  },
  {
    name: 'Enjin Legendary Sword',
    collection: 'Lost Relics',
    currentValue: 320,
    acquisitionCost: 200,
    platform: 'Enjin',
    chain: 'ethereum',
  },
];

const FALLBACK_PROPOSALS = [
  {
    id: 'SIP-42',
    title: 'SIP-42: Creator Fund Allocation Q1 2026',
    status: 'active' as const,
    dao: 'Sandbox DAO',
  },
  {
    id: 'SIP-41',
    title: 'SIP-41: LAND Staking Rewards Increase',
    status: 'passed' as const,
    votedAt: '2025-12-15',
    userVote: 'for' as const,
    dao: 'Sandbox DAO',
  },
  {
    id: 'AXS-12',
    title: 'AXS-12: Ronin Bridge Security Upgrade',
    status: 'active' as const,
    dao: 'Axie DAO',
  },
  {
    id: 'ILV-7',
    title: 'ILV-7: Revenue Distribution Increase',
    status: 'passed' as const,
    votedAt: '2025-11-01',
    userVote: 'for' as const,
    dao: 'Illuvium DAO',
  },
];

export default function GamingPage() {
  const { t } = useTranslation('gaming');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { currentSpace } = useSpaceStore();
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<MetaversePlatform>('all');

  const isGamingPersona =
    user?.email === 'diego@dhanam.demo' || user?.email === 'guest@dhanam.demo';

  const spaceId = currentSpace?.id;

  const {
    data: portfolio,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['gaming-portfolio', spaceId],
    queryFn: () => gamingApi.getPortfolio(spaceId!),
    retry: false,
    enabled: isGamingPersona && !!spaceId,
  });

  // Show connect CTA for non-gaming personas
  if (user && !isGamingPersona) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Gamepad2 className="h-8 w-8" />
            {t('page.title')}
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gamepad2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Connect Your Gaming Accounts</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              Track your metaverse assets, gaming earnings, land parcels, and NFTs across platforms
              like The Sandbox, Axie Infinity, Illuvium, and more.
            </p>
            <Button onClick={() => router.push('/connections')}>Connect Gaming Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use API data or fallback to hardcoded dev data
  const PLATFORM_DATA = portfolio?.platforms ?? FALLBACK_PLATFORM_DATA;
  const EARNINGS_DATA = portfolio?.earnings ?? FALLBACK_EARNINGS_DATA;
  const GUILD_DATA = portfolio?.guilds ?? FALLBACK_GUILD_DATA;
  const CHAIN_DATA = portfolio?.chains ?? FALLBACK_CHAIN_DATA;
  const ALL_PARCELS = portfolio?.parcels ?? FALLBACK_PARCELS;
  const ALL_NFTS = portfolio?.nfts ?? FALLBACK_NFTS;
  const ALL_PROPOSALS = portfolio?.proposals ?? FALLBACK_PROPOSALS;

  const totalGamingAssets = PLATFORM_DATA.reduce((s, p) => s + p.totalValueUsd, 0);
  const totalMonthlyIncome = EARNINGS_DATA.reduce((s, e) => s + e.amountUsd, 0);
  const totalNfts = ALL_NFTS.length;
  const platformTotals = Object.fromEntries(
    PLATFORM_DATA.map((p) => [p.platform, p.totalValueUsd])
  );

  const filteredPlatforms =
    selectedPlatform === 'all'
      ? PLATFORM_DATA
      : PLATFORM_DATA.filter((p) => p.platform === selectedPlatform);

  const filteredEarnings =
    selectedPlatform === 'all'
      ? EARNINGS_DATA
      : EARNINGS_DATA.filter((e) => e.platform === selectedPlatform);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Gamepad2 className="h-8 w-8" />
            {t('page.title')}
          </h2>
          <p className="text-muted-foreground">{t('page.loading')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-20 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && !portfolio && !isGamingPersona) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Gamepad2 className="h-8 w-8" />
            {t('page.title')}
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">{tCommon('somethingWentWrong')}</h3>
            <p className="text-muted-foreground text-center mb-4">{tCommon('loadFailed')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Gamepad2 className="h-8 w-8" />
          {t('page.title')}
        </h2>
        <p className="text-muted-foreground">
          {t('page.description')}
          {error && !portfolio && (
            <span className="text-xs text-amber-600 ml-2">{t('page.demoData')}</span>
          )}
        </p>
      </div>

      {/* Platform Selector */}
      <PlatformSelector
        selected={selectedPlatform}
        onSelect={setSelectedPlatform}
        platformTotals={platformTotals}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('summary.totalGamingAssets')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalGamingAssets, Currency.USD)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('summary.acrossPlatforms', { count: PLATFORM_DATA.length })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('summary.monthlyGamingIncome')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalMonthlyIncome, Currency.USD)}
            </div>
            <p className="text-xs text-muted-foreground">{t('summary.incomeBreakdown')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('summary.platformsConnected')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{PLATFORM_DATA.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('summary.chains', { count: CHAIN_DATA.length })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('summary.nftsOwned')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNfts}</div>
            <p className="text-xs text-muted-foreground">{t('summary.acrossAllPlatforms')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <MultiPlatformOverview platforms={filteredPlatforms} />
        <EarningsByPlatform
          earnings={filteredEarnings}
          totalMonthlyUsd={filteredEarnings.reduce((s, e) => s + e.amountUsd, 0)}
        />
        <CrossChainView chains={CHAIN_DATA} totalValueUsd={totalGamingAssets} />
        <GuildTracker guilds={GUILD_DATA} />
        <LandPortfolio
          parcels={ALL_PARCELS}
          floorPriceUsd={1450}
          totalValueUsd={ALL_PARCELS.length * 1450}
        />
        <NftGallery
          items={ALL_NFTS}
          totalValueUsd={ALL_NFTS.reduce((s, n) => s + n.currentValue, 0)}
        />
      </div>

      {/* Governance Activity */}
      <GovernanceActivity
        proposals={ALL_PROPOSALS}
        totalVotesCast={portfolio?.totalVotesCast ?? 14}
        votingPower={portfolio?.votingPower ?? 15000}
        votingPowerToken={portfolio?.votingPowerToken ?? 'SAND'}
      />
    </div>
  );
}
