import { useQuery } from '@tanstack/react-query';

import { ErrorState } from '@/components/ErrorState';
import { LoadingScreen } from '@/components/LoadingScreen';
import {
  Ionicons,
  router,
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  Chip,
  ProgressBar,
  Divider,
} from '@/lib/react-native-compat';
import { useSegments } from '@/lib/react-native-compat';
import { apiClient } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface BudgetDetail {
  id: string;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
  currency: string;
  period: string;
  categories: string[];
  startDate: string;
  endDate: string;
  status: string;
  transactions?: Array<{
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
  }>;
}

export default function BudgetDetailScreen() {
  const segments = useSegments();
  const id = segments[segments.length - 1];

  const {
    data: budget,
    isLoading,
    error,
    refetch,
  } = useQuery<BudgetDetail>({
    queryKey: ['budget', id],
    queryFn: () => apiClient.get(`/budgets/${id}`).then((res) => res.data),
    enabled: !!id,
  });

  if (isLoading) return <LoadingScreen message="Loading budget..." />;

  if (error || !budget) {
    return (
      <ErrorState
        title="Budget Not Found"
        message="Unable to load this budget."
        action={refetch}
        actionLabel="Retry"
      />
    );
  }

  const progress = Math.min(budget.spent / budget.amount, 1);
  const isOver = budget.spent > budget.amount;

  const getProgressColor = () => {
    if (progress >= 1) return '#F44336';
    if (progress >= 0.8) return '#FF9800';
    if (progress >= 0.6) return '#FFC107';
    return '#4CAF50';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'exceeded':
        return '#F44336';
      case 'completed':
        return '#757575';
      default:
        return '#757575';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Budget Header */}
        <View style={styles.headerSection}>
          <Text variant="headlineSmall" style={styles.budgetName}>
            {budget.name}
          </Text>
          <View style={styles.badgeRow}>
            <Chip
              mode="outlined"
              style={{ borderColor: getStatusColor(budget.status) }}
              textStyle={{ color: getStatusColor(budget.status) }}
            >
              {budget.status.charAt(0).toUpperCase() + budget.status.slice(1)}
            </Chip>
            <Chip mode="outlined">
              {budget.period.charAt(0).toUpperCase() + budget.period.slice(1)}
            </Chip>
          </View>
        </View>

        {/* Progress Card */}
        <Card style={styles.progressCard}>
          <Card.Content>
            <View style={styles.amountRow}>
              <View>
                <Text variant="bodySmall" style={styles.amountLabel}>
                  Spent
                </Text>
                <Text
                  variant="titleLarge"
                  style={[styles.amountValue, isOver && { color: '#F44336' }]}
                >
                  {formatCurrency(budget.spent, budget.currency)}
                </Text>
              </View>
              <View style={styles.amountRight}>
                <Text variant="bodySmall" style={styles.amountLabel}>
                  Budget
                </Text>
                <Text variant="titleLarge" style={styles.amountValue}>
                  {formatCurrency(budget.amount, budget.currency)}
                </Text>
              </View>
            </View>

            <ProgressBar
              progress={progress}
              color={getProgressColor()}
              style={styles.progressBar}
            />

            <View style={styles.progressFooter}>
              <Text variant="bodySmall" style={styles.progressText}>
                {(progress * 100).toFixed(0)}% used
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.remainingText, { color: isOver ? '#F44336' : '#4CAF50' }]}
              >
                {isOver
                  ? `Over by ${formatCurrency(budget.spent - budget.amount, budget.currency)}`
                  : `${formatCurrency(budget.remaining, budget.currency)} remaining`}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Details */}
        <Card style={styles.detailsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Details
            </Text>
            <DetailRow
              label="Period"
              value={`${new Date(budget.startDate).toLocaleDateString()} - ${new Date(budget.endDate).toLocaleDateString()}`}
            />
            <Divider style={styles.divider} />
            <DetailRow label="Currency" value={budget.currency} />
          </Card.Content>
        </Card>

        {/* Categories */}
        <Card style={styles.categoriesCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Categories
            </Text>
            <View style={styles.chipRow}>
              {budget.categories.map((cat) => (
                <Chip key={cat} mode="outlined" style={styles.categoryChip}>
                  {cat}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Recent Transactions */}
        {budget.transactions && budget.transactions.length > 0 && (
          <Card style={styles.txCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Recent Spending
              </Text>
              {budget.transactions.slice(0, 10).map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={styles.txInfo}>
                    <Text variant="bodyMedium" style={styles.txDescription}>
                      {tx.description}
                    </Text>
                    <Text variant="bodySmall" style={styles.txMeta}>
                      {tx.category} - {new Date(tx.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text variant="bodyMedium" style={styles.txAmount}>
                    -{formatCurrency(Math.abs(tx.amount), budget.currency)}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => router.back()} style={styles.backButton}>
          Back
        </Button>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text variant="bodyMedium" style={detailStyles.label}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={detailStyles.value}>
        {value}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: { color: '#757575' },
  value: { color: '#212121', fontWeight: '500', flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollView: { flex: 1 },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  budgetName: { fontWeight: '700', color: '#212121', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  progressCard: { marginHorizontal: 20, marginBottom: 16, elevation: 2 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  amountRight: { alignItems: 'flex-end' },
  amountLabel: { color: '#757575', marginBottom: 4 },
  amountValue: { fontWeight: '700', color: '#212121' },
  progressBar: { height: 10, borderRadius: 5, backgroundColor: '#E0E0E0', marginBottom: 8 },
  progressFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: '#757575', fontWeight: '600' },
  remainingText: { fontWeight: '500' },
  detailsCard: { marginHorizontal: 20, marginBottom: 16, elevation: 1 },
  sectionTitle: { color: '#212121', fontWeight: '600', marginBottom: 12 },
  divider: { backgroundColor: '#f3f4f6' },
  categoriesCard: { marginHorizontal: 20, marginBottom: 16, elevation: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { backgroundColor: '#FAFAFA' },
  txCard: { marginHorizontal: 20, marginBottom: 16, elevation: 1 },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  txInfo: { flex: 1, marginRight: 12 },
  txDescription: { color: '#212121' },
  txMeta: { color: '#757575', marginTop: 2 },
  txAmount: { fontWeight: '600', color: '#F44336' },
  bottomPadding: { height: 100 },
  actions: { padding: 20 },
  backButton: { width: '100%' },
});
