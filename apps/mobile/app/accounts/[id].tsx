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
  Divider,
} from '@/lib/react-native-compat';
import { useSegments } from '@/lib/react-native-compat';
import { apiClient } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface AccountDetail {
  id: string;
  name: string;
  type: string;
  provider: string;
  currency: string;
  balance: number;
  lastSyncedAt: string;
  institution?: string;
  mask?: string;
  recentTransactions?: Array<{
    id: string;
    description: string;
    amount: number;
    date: string;
    type: string;
  }>;
}

export default function AccountDetailScreen() {
  const segments = useSegments();
  const id = segments[segments.length - 1];

  const {
    data: account,
    isLoading,
    error,
    refetch,
  } = useQuery<AccountDetail>({
    queryKey: ['account', id],
    queryFn: () => apiClient.get(`/accounts/${id}`).then((res) => res.data),
    enabled: !!id,
  });

  if (isLoading) return <LoadingScreen message="Loading account..." />;

  if (error || !account) {
    return (
      <ErrorState
        title="Account Not Found"
        message="Unable to load this account."
        action={refetch}
        actionLabel="Retry"
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Header */}
        <View style={styles.balanceSection}>
          <View style={styles.accountIcon}>
            <Ionicons name="card-outline" size={32} color="#4CAF50" />
          </View>
          <Text variant="headlineSmall" style={styles.accountName}>
            {account.name}
          </Text>
          <Text variant="displaySmall" style={styles.balance}>
            {formatCurrency(account.balance, account.currency)}
          </Text>
          <View style={styles.badgeRow}>
            <Chip mode="outlined" style={styles.typeBadge}>
              {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
            </Chip>
            <Chip mode="flat" style={[styles.providerBadge, { backgroundColor: '#E3F2FD' }]}>
              {account.provider.toUpperCase()}
            </Chip>
          </View>
        </View>

        {/* Details Card */}
        <Card style={styles.detailsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Details
            </Text>
            <DetailRow
              label="Type"
              value={account.type.charAt(0).toUpperCase() + account.type.slice(1)}
            />
            <Divider style={styles.divider} />
            <DetailRow label="Provider" value={account.provider.toUpperCase()} />
            <Divider style={styles.divider} />
            <DetailRow label="Currency" value={account.currency} />
            <Divider style={styles.divider} />
            <DetailRow
              label="Last Synced"
              value={new Date(account.lastSyncedAt).toLocaleDateString()}
            />
            {account.institution && (
              <>
                <Divider style={styles.divider} />
                <DetailRow label="Institution" value={account.institution} />
              </>
            )}
            {account.mask && (
              <>
                <Divider style={styles.divider} />
                <DetailRow label="Account" value={`****${account.mask}`} />
              </>
            )}
          </Card.Content>
        </Card>

        {/* Recent Transactions */}
        {account.recentTransactions && account.recentTransactions.length > 0 && (
          <Card style={styles.transactionsCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Recent Transactions
              </Text>
              {account.recentTransactions.slice(0, 5).map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={styles.txInfo}>
                    <Text variant="bodyMedium" style={styles.txDescription}>
                      {tx.description}
                    </Text>
                    <Text variant="bodySmall" style={styles.txDate}>
                      {new Date(tx.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.txAmount,
                      { color: tx.type === 'income' ? '#4CAF50' : '#F44336' },
                    ]}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(Math.abs(tx.amount), account.currency)}
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
  value: { color: '#212121', fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollView: { flex: 1 },
  balanceSection: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  accountIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  accountName: { fontWeight: '600', color: '#212121', marginBottom: 8 },
  balance: { fontWeight: '700', color: '#212121', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  typeBadge: { backgroundColor: '#FAFAFA' },
  providerBadge: {},
  detailsCard: { marginHorizontal: 20, marginBottom: 16, elevation: 2 },
  sectionTitle: { color: '#212121', fontWeight: '600', marginBottom: 8 },
  divider: { backgroundColor: '#f3f4f6' },
  transactionsCard: { marginHorizontal: 20, marginBottom: 16, elevation: 1 },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  txInfo: { flex: 1, marginRight: 12 },
  txDescription: { color: '#212121' },
  txDate: { color: '#757575', marginTop: 2 },
  txAmount: { fontWeight: '600' },
  bottomPadding: { height: 100 },
  actions: { padding: 20 },
  backButton: { width: '100%' },
});
