import { Account, Transaction } from '@dhanam/shared';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo } from 'react';

import { AccountCard } from '@/components/AccountCard';
import { ErrorState } from '@/components/ErrorState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { TransactionItem } from '@/components/TransactionItem';
import { useAuth } from '@/hooks/useAuth';
import { useSpaces } from '@/hooks/useSpaces';
import {
  router,
  ScrollView,
  View,
  RefreshControl,
  Dimensions,
  PaperText as Text,
  Card,
  FAB,
  Button,
} from '@/lib/react-native-compat';
import { LineChart } from '@/lib/chart-kit-compat';
import { apiClient } from '@/services/api';
import { styles } from '@/styles/dashboard';
import { theme } from '@/theme';
import { formatCurrency } from '@/utils/currency';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { user } = useAuth();
  const { currentSpace } = useSpaces();

  const {
    data: accounts,
    isLoading: accountsLoading,
    refetch: refetchAccounts,
  } = useQuery({
    queryKey: ['accounts', currentSpace?.id],
    queryFn: () => {
      if (!currentSpace) throw new Error('No space selected');
      return apiClient.get(`/accounts?spaceId=${currentSpace.id}`).then((res) => res.data);
    },
    enabled: !!currentSpace,
  });

  const {
    data: transactions,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ['transactions', currentSpace?.id],
    queryFn: () => {
      if (!currentSpace) throw new Error('No space selected');
      return apiClient
        .get(`/transactions?spaceId=${currentSpace.id}&limit=10`)
        .then((res) => res.data);
    },
    enabled: !!currentSpace,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', currentSpace?.id],
    queryFn: () => {
      if (!currentSpace) throw new Error('No space selected');
      return apiClient
        .get(`/analytics/dashboard?spaceId=${currentSpace.id}`)
        .then((res) => res.data);
    },
    enabled: !!currentSpace,
  });

  const isLoading = accountsLoading || transactionsLoading || analyticsLoading;
  const isRefreshing = false;

  const onRefresh = async () => {
    await Promise.all([refetchAccounts(), refetchTransactions()]);
  };

  const netWorth = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum: number, account: Account) => sum + (account.balance || 0), 0);
  }, [accounts]);

  const chartData = useMemo(() => {
    if (!analytics?.balanceHistory) {
      return {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{ data: [0, 0, 0, 0, 0, 0] }],
      };
    }
    return {
      labels: analytics.balanceHistory.map((item: { date: string }) =>
        new Date(item.date).toLocaleDateString('en', { month: 'short' })
      ),
      datasets: [
        {
          data: analytics.balanceHistory.map((item: { balance: number }) => item.balance),
          strokeWidth: 3,
        },
      ],
    };
  }, [analytics]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!currentSpace) {
    return (
      <ErrorState
        title="No Space Selected"
        message="Please select or create a space to continue"
        action={() => router.push('/spaces')}
        actionLabel="Manage Spaces"
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.greeting}>
            Hello, {user?.name?.split(' ')[0]} 👋
          </Text>
          <Text variant="bodyLarge" style={styles.spaceTitle}>
            {currentSpace.name}
          </Text>
        </View>

        {/* Net Worth */}
        <Card style={styles.netWorthCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.netWorthLabel}>
              Net Worth
            </Text>
            <Text variant="displaySmall" style={styles.netWorthValue}>
              {formatCurrency(netWorth, currentSpace.currency)}
            </Text>
            <Text variant="bodySmall" style={styles.netWorthChange}>
              {analytics?.monthlyChange > 0 ? '+' : ''}
              {formatCurrency(analytics?.monthlyChange || 0, currentSpace.currency)} this month
            </Text>
          </Card.Content>
        </Card>

        {/* Chart */}
        {chartData.datasets[0].data.some((value: number) => value > 0) && (
          <Card style={styles.chartCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.chartTitle}>
                Balance Trend
              </Text>
              <LineChart
                data={chartData}
                width={screenWidth - 60}
                height={200}
                chartConfig={{
                  backgroundColor: theme.light.colors.surface,
                  backgroundGradientFrom: theme.light.colors.surface,
                  backgroundGradientTo: theme.light.colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (_opacity = 1) => theme.light.colors.onSurface,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: theme.light.colors.primary,
                  },
                }}
                bezier
                style={styles.chart}
              />
            </Card.Content>
          </Card>
        )}

        {/* Quick Actions */}
        <Card style={styles.quickActionsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Quick Actions
            </Text>
            <View style={styles.quickActionsGrid}>
              <Button
                mode="outlined"
                onPress={() => router.push('/accounts/add')}
                style={styles.quickAction}
              >
                Add Account
              </Button>
              <Button
                mode="outlined"
                onPress={() => router.push('/transactions/add')}
                style={styles.quickAction}
              >
                Add Transaction
              </Button>
              <Button
                mode="outlined"
                onPress={() => router.push('/budgets/create')}
                style={styles.quickAction}
              >
                Create Budget
              </Button>
              <Button
                mode="outlined"
                onPress={() => router.push('/esg')}
                style={styles.quickAction}
              >
                ESG Analysis
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Recent Accounts */}
        {accounts && accounts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Accounts
              </Text>
              <Button mode="text" onPress={() => router.push('/(tabs)/accounts')}>
                View All
              </Button>
            </View>
            {accounts.slice(0, 3).map((account: Account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </View>
        )}

        {/* Recent Transactions */}
        {transactions?.data && transactions.data.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Recent Transactions
              </Text>
              <Button mode="text" onPress={() => router.push('/(tabs)/transactions')}>
                View All
              </Button>
            </View>
            <Card style={styles.transactionsCard}>
              <Card.Content>
                {transactions.data.slice(0, 5).map((transaction: Transaction) => (
                  <TransactionItem key={transaction.id} transaction={transaction} />
                ))}
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Empty State */}
        {(!accounts || accounts.length === 0) && (
          <View style={styles.emptyState}>
            <Text variant="headlineSmall" style={styles.emptyStateTitle}>
              Welcome to Dhanam Ledger! 🚀
            </Text>
            <Text variant="bodyLarge" style={styles.emptyStateMessage}>
              Start by connecting your accounts to track your finances
            </Text>
            <Button
              mode="contained"
              onPress={() => router.push('/(tabs)/accounts')}
              style={styles.emptyStateAction}
            >
              Connect Your First Account
            </Button>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Action Button */}
      <FAB icon="plus" style={styles.fab} onPress={() => router.push('/transactions/add')} />
    </View>
  );
}
