import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ErrorState } from '@/components/ErrorState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useSpaces } from '@/hooks/useSpaces';
import {
  Ionicons,
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  PaperText as Text,
  Card,
  SegmentedButtons,
  ProgressBar,
} from '@/lib/react-native-compat';
import { apiClient } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface SpendingCategory {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

interface AnalyticsData {
  period: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  spendingByCategory: SpendingCategory[];
  averageDaily: number;
  largestExpense: {
    description: string;
    amount: number;
    date: string;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  food: '#FF9800',
  transport: '#2196F3',
  shopping: '#E91E63',
  entertainment: '#9C27B0',
  bills: '#607D8B',
  healthcare: '#F44336',
  investment: '#4CAF50',
  other: '#795548',
};

export default function AnalyticsScreen() {
  const { currentSpace } = useSpaces();
  const [period, setPeriod] = useState('month');

  const {
    data: analytics,
    isLoading,
    refetch,
    error,
  } = useQuery<AnalyticsData>({
    queryKey: ['analytics', currentSpace?.id, period],
    queryFn: async () => {
      if (!currentSpace) throw new Error('No space selected');
      const response = await apiClient.get(
        `/analytics?spaceId=${currentSpace.id}&period=${period}`
      );
      return response.data;
    },
    enabled: !!currentSpace,
  });

  if (isLoading) {
    return <LoadingScreen message="Loading analytics..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Analytics"
        message="Unable to fetch your analytics. Please try again."
        action={refetch}
        actionLabel="Retry"
      />
    );
  }

  if (!currentSpace) {
    return (
      <ErrorState
        title="No Space Selected"
        message="Please select a space to view analytics"
        action={() => {}}
        actionLabel="Select Space"
      />
    );
  }

  const currency = currentSpace.currency || 'USD';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <SegmentedButtons
            value={period}
            onValueChange={setPeriod}
            buttons={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'quarter', label: 'Quarter' },
              { value: 'year', label: 'Year' },
            ]}
          />
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <Card style={[styles.summaryCard, styles.incomeCard]}>
            <Card.Content style={styles.summaryContent}>
              <Ionicons name="arrow-down-circle" size={24} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.summaryLabel}>
                Income
              </Text>
              <Text variant="titleMedium" style={styles.incomeAmount}>
                {formatCurrency(analytics?.totalIncome || 0, currency)}
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, styles.expenseCard]}>
            <Card.Content style={styles.summaryContent}>
              <Ionicons name="arrow-up-circle" size={24} color="#F44336" />
              <Text variant="bodySmall" style={styles.summaryLabel}>
                Expenses
              </Text>
              <Text variant="titleMedium" style={styles.expenseAmount}>
                {formatCurrency(analytics?.totalExpenses || 0, currency)}
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Net Savings Card */}
        <Card style={styles.savingsCard}>
          <Card.Content>
            <View style={styles.savingsHeader}>
              <Text variant="titleMedium" style={styles.savingsTitle}>
                Net Savings
              </Text>
              <Text
                variant="headlineSmall"
                style={[
                  styles.savingsAmount,
                  {
                    color: (analytics?.netSavings || 0) >= 0 ? '#4CAF50' : '#F44336',
                  },
                ]}
              >
                {formatCurrency(analytics?.netSavings || 0, currency)}
              </Text>
            </View>
            <View style={styles.savingsRateContainer}>
              <Text variant="bodySmall" style={styles.savingsRateLabel}>
                Savings Rate
              </Text>
              <View style={styles.savingsRateBar}>
                <ProgressBar
                  progress={(analytics?.savingsRate || 0) / 100}
                  color="#4CAF50"
                  style={styles.progressBar}
                />
                <Text variant="bodySmall" style={styles.savingsRateValue}>
                  {(analytics?.savingsRate || 0).toFixed(1)}%
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Spending by Category */}
        <Card style={styles.categoryCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.categoryTitle}>
              Spending by Category
            </Text>

            {analytics?.spendingByCategory?.map((category) => (
              <View key={category.category} style={styles.categoryItem}>
                <View style={styles.categoryInfo}>
                  <View
                    style={[
                      styles.categoryDot,
                      {
                        backgroundColor:
                          CATEGORY_COLORS[category.category.toLowerCase()] || '#757575',
                      },
                    ]}
                  />
                  <Text variant="bodyMedium" style={styles.categoryName}>
                    {category.category}
                  </Text>
                </View>
                <View style={styles.categoryValues}>
                  <Text variant="bodyMedium" style={styles.categoryAmount}>
                    {formatCurrency(category.amount, currency)}
                  </Text>
                  <View style={styles.categoryTrend}>
                    <Ionicons
                      name={
                        category.trend === 'up'
                          ? 'trending-up'
                          : category.trend === 'down'
                            ? 'trending-down'
                            : 'remove'
                      }
                      size={14}
                      color={
                        category.trend === 'up'
                          ? '#F44336'
                          : category.trend === 'down'
                            ? '#4CAF50'
                            : '#757575'
                      }
                    />
                    <Text
                      variant="bodySmall"
                      style={[
                        styles.trendPercent,
                        {
                          color:
                            category.trend === 'up'
                              ? '#F44336'
                              : category.trend === 'down'
                                ? '#4CAF50'
                                : '#757575',
                        },
                      ]}
                    >
                      {category.trendPercent}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Quick Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.statsTitle}>
              Quick Stats
            </Text>

            <View style={styles.statRow}>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Average Daily Spending
              </Text>
              <Text variant="bodyMedium" style={styles.statValue}>
                {formatCurrency(analytics?.averageDaily || 0, currency)}
              </Text>
            </View>

            {analytics?.largestExpense && (
              <View style={styles.statRow}>
                <Text variant="bodyMedium" style={styles.statLabel}>
                  Largest Expense
                </Text>
                <View style={styles.largestExpense}>
                  <Text variant="bodyMedium" style={styles.statValue}>
                    {formatCurrency(analytics.largestExpense.amount, currency)}
                  </Text>
                  <Text variant="bodySmall" style={styles.largestExpenseDesc}>
                    {analytics.largestExpense.description}
                  </Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  periodSelector: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    elevation: 1,
  },
  incomeCard: {
    backgroundColor: '#E8F5E8',
  },
  expenseCard: {
    backgroundColor: '#FFEBEE',
  },
  summaryContent: {
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    color: '#757575',
  },
  incomeAmount: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  expenseAmount: {
    color: '#F44336',
    fontWeight: '600',
  },
  savingsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    elevation: 1,
  },
  savingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  savingsTitle: {
    color: '#212121',
  },
  savingsAmount: {
    fontWeight: '700',
  },
  savingsRateContainer: {
    gap: 8,
  },
  savingsRateLabel: {
    color: '#757575',
  },
  savingsRateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  savingsRateValue: {
    color: '#4CAF50',
    fontWeight: '600',
    minWidth: 40,
  },
  categoryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    elevation: 1,
  },
  categoryTitle: {
    color: '#212121',
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    color: '#212121',
    textTransform: 'capitalize',
  },
  categoryValues: {
    alignItems: 'flex-end',
    gap: 2,
  },
  categoryAmount: {
    color: '#212121',
    fontWeight: '500',
  },
  categoryTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendPercent: {
    fontSize: 12,
  },
  statsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    elevation: 1,
  },
  statsTitle: {
    color: '#212121',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statLabel: {
    color: '#757575',
  },
  statValue: {
    color: '#212121',
    fontWeight: '500',
  },
  largestExpense: {
    alignItems: 'flex-end',
  },
  largestExpenseDesc: {
    color: '#757575',
    marginTop: 2,
  },
  bottomPadding: {
    height: 40,
  },
});
