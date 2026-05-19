import { useQuery } from '@tanstack/react-query';
import { ComponentProps } from 'react';

import { ErrorState } from '@/components/ErrorState';
import { LoadingScreen } from '@/components/LoadingScreen';
import {
  Ionicons,
  router,
  View,
  ScrollView,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  Chip,
  Divider,
} from '@/lib/react-native-compat';
import { useSegments } from '@/lib/react-native-compat';
import { apiClient } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface TransactionDetail {
  id: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  accountName: string;
  provider: string;
  pending: boolean;
  tags: string[];
  notes?: string;
}

export default function TransactionDetailScreen() {
  const segments = useSegments();
  const id = segments[segments.length - 1];

  const {
    data: transaction,
    isLoading,
    error,
    refetch,
  } = useQuery<TransactionDetail>({
    queryKey: ['transaction', id],
    queryFn: () => apiClient.get(`/transactions/${id}`).then((res) => res.data),
    enabled: !!id,
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return '#4CAF50';
      case 'expense':
        return '#F44336';
      case 'transfer':
        return '#2196F3';
      default:
        return '#757575';
    }
  };

  const getTypeIcon = (type: string): ComponentProps<typeof Ionicons>['name'] => {
    switch (type) {
      case 'income':
        return 'arrow-down-circle';
      case 'expense':
        return 'arrow-up-circle';
      case 'transfer':
        return 'swap-horizontal';
      default:
        return 'card';
    }
  };

  if (isLoading) return <LoadingScreen message="Loading transaction..." />;

  if (error || !transaction) {
    return (
      <ErrorState
        title="Transaction Not Found"
        message="Unable to load this transaction."
        action={refetch}
        actionLabel="Retry"
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Amount Header */}
        <View style={styles.amountSection}>
          <View
            style={[
              styles.typeIconContainer,
              { backgroundColor: `${getTypeColor(transaction.type)}15` },
            ]}
          >
            <Ionicons
              name={getTypeIcon(transaction.type)}
              size={32}
              color={getTypeColor(transaction.type)}
            />
          </View>
          <Text
            variant="displaySmall"
            style={[styles.amount, { color: getTypeColor(transaction.type) }]}
          >
            {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : ''}
            {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
          </Text>
          <Text variant="bodyLarge" style={styles.description}>
            {transaction.description}
          </Text>
          {transaction.pending && (
            <Chip mode="outlined" style={styles.pendingChip} textStyle={styles.pendingChipText}>
              Pending
            </Chip>
          )}
        </View>

        {/* Details Card */}
        <Card style={styles.detailsCard}>
          <Card.Content>
            <DetailRow label="Date" value={new Date(transaction.date).toLocaleDateString()} />
            <Divider style={styles.divider} />
            <DetailRow label="Category" value={transaction.category} />
            <Divider style={styles.divider} />
            <DetailRow label="Account" value={transaction.accountName} />
            <Divider style={styles.divider} />
            <DetailRow
              label="Type"
              value={transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
            />
            <Divider style={styles.divider} />
            <DetailRow label="Provider" value={transaction.provider.toUpperCase()} />
          </Card.Content>
        </Card>

        {/* Tags */}
        {transaction.tags && transaction.tags.length > 0 && (
          <Card style={styles.tagsCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Tags
              </Text>
              <View style={styles.tagRow}>
                {transaction.tags.map((tag) => (
                  <Chip key={tag} mode="outlined" style={styles.tagChip}>
                    {tag}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Notes */}
        {transaction.notes && (
          <Card style={styles.notesCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Notes
              </Text>
              <Text variant="bodyMedium" style={styles.notesText}>
                {transaction.notes}
              </Text>
            </Card.Content>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Actions */}
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
  label: {
    color: '#757575',
  },
  value: {
    color: '#212121',
    fontWeight: '500',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  typeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  amount: {
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: '#757575',
    textAlign: 'center',
  },
  pendingChip: {
    marginTop: 8,
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  pendingChipText: {
    color: '#FF9800',
  },
  detailsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 2,
  },
  divider: {
    backgroundColor: '#f3f4f6',
  },
  tagsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 1,
  },
  sectionTitle: {
    color: '#212121',
    fontWeight: '600',
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#FAFAFA',
  },
  notesCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 1,
  },
  notesText: {
    color: '#424242',
    lineHeight: 22,
  },
  bottomPadding: {
    height: 100,
  },
  actions: {
    padding: 20,
  },
  backButton: {
    width: '100%',
  },
});
