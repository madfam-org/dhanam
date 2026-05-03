'use client';

import type { Transaction } from '@dhanam/shared';
import { Card, CardContent, Button } from '@dhanam/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Lightbulb,
  Trophy,
  BarChart3,
  Users,
  Wallet,
  Fuel,
  TrendingUp,
  TrendingDown,
  CreditCard,
  PiggyBank,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';

import { transactionsApi } from '~/lib/api/transactions';
import { useAuth } from '~/lib/hooks/use-auth';
import { useSpaceStore } from '~/stores/space';

interface Insight {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  message: string;
  link: string;
  linkLabel: string;
}

// Static fallback insights per persona
const personaFallbackInsights: Record<string, Insight[]> = {
  'maria@dhanam.demo': [
    {
      id: 'maria-gym',
      icon: Lightbulb,
      iconColor: 'text-yellow-500',
      message:
        'You could save MXN 7,188/yr by canceling the Bodytech Gym subscription we detected.',
      link: '/transactions',
      linkLabel: 'Review subscriptions',
    },
    {
      id: 'maria-savings',
      icon: Trophy,
      iconColor: 'text-amber-500',
      message: 'Your savings rate is 29% — in the top 15% of Dhanam users in Mexico.',
      link: '/analytics',
      linkLabel: 'View analytics',
    },
  ],
  'carlos@dhanam.demo': [
    {
      id: 'carlos-reserves',
      icon: BarChart3,
      iconColor: 'text-blue-500',
      message: 'Business cash reserves cover 2.4 months of operating expenses.',
      link: '/analytics',
      linkLabel: 'View cash position',
    },
    {
      id: 'carlos-splits',
      icon: Users,
      iconColor: 'text-purple-500',
      message: "3 shared expenses with Ana haven't been split yet this month.",
      link: '/households',
      linkLabel: 'Split expenses',
    },
  ],
  'patricia@dhanam.demo': [
    {
      id: 'patricia-pe',
      icon: Wallet,
      iconColor: 'text-green-500',
      message:
        'Your PE distribution of $12K arrived — consider rebalancing to maintain allocation targets.',
      link: '/analytics',
      linkLabel: 'View portfolio',
    },
  ],
  'diego@dhanam.demo': [
    {
      id: 'diego-gas',
      icon: Fuel,
      iconColor: 'text-orange-500',
      message: 'Gas fees down 40% this week — good time to rebalance DeFi positions.',
      link: '/gaming',
      linkLabel: 'View DeFi',
    },
  ],
};

function generateDynamicInsights(transactions: Transaction[]): Insight[] {
  if (!transactions || transactions.length === 0) return [];

  const insights: Insight[] = [];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const thisMonthTxns = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const lastMonthTxns = transactions.filter((t) => {
    const d = new Date(t.date);
    const lm = thisMonth === 0 ? 11 : thisMonth - 1;
    const ly = thisMonth === 0 ? thisYear - 1 : thisYear;
    return d.getMonth() === lm && d.getFullYear() === ly;
  });

  // Category spending comparison (month-over-month)
  const thisMonthByCategory = new Map<string, number>();
  const lastMonthByCategory = new Map<string, number>();

  for (const t of thisMonthTxns) {
    if (t.amount < 0 && t.category?.name) {
      const cat = t.category.name;
      thisMonthByCategory.set(cat, (thisMonthByCategory.get(cat) || 0) + Math.abs(t.amount));
    }
  }
  for (const t of lastMonthTxns) {
    if (t.amount < 0 && t.category?.name) {
      const cat = t.category.name;
      lastMonthByCategory.set(cat, (lastMonthByCategory.get(cat) || 0) + Math.abs(t.amount));
    }
  }

  // Find biggest category increase
  let maxIncrease = 0;
  let maxIncreaseCat = '';
  for (const [cat, amount] of thisMonthByCategory) {
    const prev = lastMonthByCategory.get(cat) || 0;
    if (prev > 0) {
      const pctChange = ((amount - prev) / prev) * 100;
      if (pctChange > maxIncrease && pctChange > 15) {
        maxIncrease = pctChange;
        maxIncreaseCat = cat;
      }
    }
  }

  if (maxIncreaseCat) {
    insights.push({
      id: 'dynamic-category-increase',
      icon: TrendingUp,
      iconColor: 'text-red-500',
      message: `${maxIncreaseCat} spending up ${Math.round(maxIncrease)}% vs last month.`,
      link: '/analytics',
      linkLabel: 'View breakdown',
    });
  }

  // Largest single expense this month
  const largestExpense = thisMonthTxns
    .filter((t) => t.amount < 0)
    .sort((a, b) => a.amount - b.amount)[0];

  if (largestExpense) {
    const amt = Math.abs(largestExpense.amount).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    insights.push({
      id: 'dynamic-largest-expense',
      icon: CreditCard,
      iconColor: 'text-orange-500',
      message: `Biggest expense this month: $${amt} — ${largestExpense.description}.`,
      link: '/transactions',
      linkLabel: 'View transactions',
    });
  }

  // Savings rate
  const totalIncome = thisMonthTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = Math.abs(
    thisMonthTxns.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
  );
  if (totalIncome > 0) {
    const savingsRate = Math.round(((totalIncome - totalExpenses) / totalIncome) * 100);
    if (savingsRate > 0) {
      insights.push({
        id: 'dynamic-savings-rate',
        icon: PiggyBank,
        iconColor: 'text-green-500',
        message: `You're saving ${savingsRate}% of your income this month.`,
        link: '/analytics',
        linkLabel: 'View analytics',
      });
    }
  }

  // Spending decrease highlight
  let maxDecrease = 0;
  let maxDecreaseCat = '';
  for (const [cat, amount] of thisMonthByCategory) {
    const prev = lastMonthByCategory.get(cat) || 0;
    if (prev > 0) {
      const pctChange = ((prev - amount) / prev) * 100;
      if (pctChange > maxDecrease && pctChange > 15) {
        maxDecrease = pctChange;
        maxDecreaseCat = cat;
      }
    }
  }

  if (maxDecreaseCat) {
    insights.push({
      id: 'dynamic-category-decrease',
      icon: TrendingDown,
      iconColor: 'text-green-600',
      message: `Nice! ${maxDecreaseCat} spending down ${Math.round(maxDecrease)}% vs last month.`,
      link: '/analytics',
      linkLabel: 'Keep it up',
    });
  }

  return insights.slice(0, 3);
}

export function InsightCards() {
  const { user } = useAuth();
  const { currentSpace } = useSpaceStore();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Fetch recent transactions for dynamic insights
  const { data: txnData } = useQuery({
    queryKey: ['insight-transactions', currentSpace?.id],
    queryFn: () => {
      if (!currentSpace) throw new Error('No space');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      return transactionsApi.getTransactions(currentSpace.id, {
        limit: 200,
        sortBy: 'date',
        sortOrder: 'desc',
        startDate,
      });
    },
    enabled: !!currentSpace,
    staleTime: 5 * 60 * 1000,
  });

  const dynamicInsights = useMemo(
    () => generateDynamicInsights(txnData?.data ?? []),
    [txnData?.data]
  );

  // Merge: dynamic first, then persona fallbacks
  const fallbackInsights = user?.email ? (personaFallbackInsights[user.email] ?? []) : [];
  const allInsights = useMemo(() => {
    const ids = new Set(dynamicInsights.map((i) => i.id));
    const combined = [...dynamicInsights];
    for (const fb of fallbackInsights) {
      if (!ids.has(fb.id)) {
        combined.push(fb);
      }
    }
    return combined.slice(0, 4);
  }, [dynamicInsights, fallbackInsights]);

  const visible = allInsights.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {visible.map((insight) => {
        const Icon = insight.icon;
        return (
          <Card key={insight.id} className="relative">
            <button
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted"
              onClick={() => setDismissed((prev) => new Set(prev).add(insight.id))}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
            <CardContent className="flex items-start gap-3 pt-4 pb-3">
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${insight.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{insight.message}</p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-1 text-xs"
                  onClick={() => router.push(insight.link)}
                >
                  {insight.linkLabel} &rarr;
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
