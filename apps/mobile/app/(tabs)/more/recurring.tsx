import React, { useState, useCallback } from 'react';
import { RefreshControl, Alert } from 'react-native';

import {
  useRecurring,
  useRecurringSummary,
  useDetectRecurring,
  useConfirmRecurring,
  useDismissRecurring,
  useTogglePauseRecurring,
  useDeleteRecurring,
  RecurringTransaction,
  RecurrenceFrequency,
} from '@/hooks/api/useRecurring';
import {
  Ionicons,
  View,
  ScrollView,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  IconButton,
  Chip,
  SegmentedButtons,
  ActivityIndicator,
  Divider,
} from '@/lib/react-native-compat';

const frequencyLabels: Record<RecurrenceFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const statusColors: Record<string, string> = {
  detected: '#FFF3E0',
  confirmed: '#E8F5E9',
  dismissed: '#EEEEEE',
  paused: '#E3F2FD',
};

const statusTextColors: Record<string, string> = {
  detected: '#E65100',
  confirmed: '#2E7D32',
  dismissed: '#757575',
  paused: '#1565C0',
};

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function RecurringScreen() {
  const [activeTab, setActiveTab] = useState('confirmed');
  const [refreshing, setRefreshing] = useState(false);

  const { data: recurringData, isLoading, refetch } = useRecurring({ includeDetected: true });
  const { data: summary } = useRecurringSummary();

  const detectMutation = useDetectRecurring();
  const confirmMutation = useConfirmRecurring();
  const dismissMutation = useDismissRecurring();
  const togglePauseMutation = useTogglePauseRecurring();
  const deleteMutation = useDeleteRecurring();

  const confirmed = recurringData?.filter((r) => r.status === 'confirmed') || [];
  const detected = recurringData?.filter((r) => r.status === 'detected') || [];
  const paused = recurringData?.filter((r) => r.status === 'paused') || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDetect = async () => {
    try {
      const result = await detectMutation.mutateAsync();
      Alert.alert('Success', `Detected ${result.detected?.length || 0} new recurring patterns`);
    } catch (error) {
      Alert.alert('Error', 'Failed to detect patterns');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await confirmMutation.mutateAsync(id);
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm pattern');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissMutation.mutateAsync(id);
    } catch (error) {
      Alert.alert('Error', 'Failed to dismiss pattern');
    }
  };

  const handleTogglePause = async (id: string) => {
    try {
      await togglePauseMutation.mutateAsync(id);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleDelete = (id: string, merchantName: string) => {
    Alert.alert('Delete Recurring', `Are you sure you want to delete "${merchantName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(id);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete pattern');
          }
        },
      },
    ]);
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'confirmed':
        return confirmed;
      case 'detected':
        return detected;
      case 'paused':
        return paused;
      default:
        return confirmed;
    }
  };

  const renderEmptyState = () => {
    const messages = {
      confirmed: {
        icon: 'repeat-outline' as const,
        title: 'No confirmed recurring',
        description: 'Click "Detect Patterns" to find recurring transactions',
      },
      detected: {
        icon: 'alert-circle-outline' as const,
        title: 'No patterns detected',
        description: 'Your transaction history will be analyzed for recurring patterns',
      },
      paused: {
        icon: 'pause-circle-outline' as const,
        title: 'No paused patterns',
        description: 'Paused patterns will appear here',
      },
    };
    const msg = messages[activeTab as keyof typeof messages] || messages.confirmed;

    return (
      <View style={styles.emptyState}>
        <Ionicons name={msg.icon} size={48} color="#BDBDBD" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          {msg.title}
        </Text>
        <Text variant="bodyMedium" style={styles.emptyDescription}>
          {msg.description}
        </Text>
      </View>
    );
  };

  const renderRecurringCard = (item: RecurringTransaction) => {
    const isPaused = item.status === 'paused';
    const isDetected = item.status === 'detected';

    return (
      <Card key={item.id} style={[styles.card, isDetected && styles.detectedCard]}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={isDetected ? 'alert-circle-outline' : 'repeat-outline'}
                size={24}
                color={isDetected ? '#E65100' : '#4CAF50'}
              />
            </View>
            <View style={styles.cardInfo}>
              <Text variant="titleMedium" style={styles.merchantName}>
                {item.merchantName}
              </Text>
              <Text variant="bodySmall" style={styles.cardSubtext}>
                {frequencyLabels[item.frequency]} •{' '}
                {item.nextExpected ? `Next: ${formatDate(item.nextExpected)}` : 'N/A'}
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text variant="titleMedium" style={styles.amount}>
                {formatCurrency(-item.expectedAmount, item.currency)}
              </Text>
              <Chip
                compact
                textStyle={styles.chipText}
                style={[styles.chip, { backgroundColor: statusColors[item.status] }]}
              >
                <Text style={{ color: statusTextColors[item.status], fontSize: 10 }}>
                  {item.status}
                </Text>
              </Chip>
            </View>
          </View>

          {isDetected ? (
            <View style={styles.detectedActions}>
              <Text variant="bodySmall" style={styles.confidenceText}>
                {item.occurrenceCount} occurrences • {Math.round(item.confidence * 100)}% confidence
              </Text>
              <View style={styles.actionButtons}>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => handleDismiss(item.id)}
                  style={styles.dismissButton}
                >
                  Dismiss
                </Button>
                <Button
                  mode="contained"
                  compact
                  onPress={() => handleConfirm(item.id)}
                  buttonColor="#4CAF50"
                >
                  Confirm
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.confirmedActions}>
              <IconButton
                icon={isPaused ? 'play-circle-outline' : 'pause-circle-outline'}
                size={20}
                onPress={() => handleTogglePause(item.id)}
              />
              <IconButton
                icon="trash-outline"
                size={20}
                iconColor="#F44336"
                onPress={() => handleDelete(item.id, item.merchantName)}
              />
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Cards */}
        {summary && (
          <View style={styles.summaryContainer}>
            <Card style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                <Ionicons name="cash-outline" size={20} color="#757575" />
                <View>
                  <Text variant="titleMedium" style={styles.summaryValue}>
                    {formatCurrency(summary.totalMonthly, summary.currency)}
                  </Text>
                  <Text variant="bodySmall" style={styles.summaryLabel}>
                    Monthly
                  </Text>
                </View>
              </Card.Content>
            </Card>
            <Card style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                <Ionicons name="repeat-outline" size={20} color="#757575" />
                <View>
                  <Text variant="titleMedium" style={styles.summaryValue}>
                    {summary.activeCount}
                  </Text>
                  <Text variant="bodySmall" style={styles.summaryLabel}>
                    Active
                  </Text>
                </View>
              </Card.Content>
            </Card>
            <Card style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                <Ionicons name="alert-circle-outline" size={20} color="#757575" />
                <View>
                  <Text variant="titleMedium" style={styles.summaryValue}>
                    {summary.detectedCount}
                  </Text>
                  <Text variant="bodySmall" style={styles.summaryLabel}>
                    Detected
                  </Text>
                </View>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Detect Button */}
        <Button
          mode="contained"
          icon="refresh"
          onPress={handleDetect}
          loading={detectMutation.isPending}
          disabled={detectMutation.isPending}
          style={styles.detectButton}
          buttonColor="#4CAF50"
        >
          Detect Patterns
        </Button>

        {/* Tab Selector */}
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={[
            { value: 'confirmed', label: `Active (${confirmed.length})` },
            { value: 'detected', label: `Detected (${detected.length})` },
            { value: 'paused', label: `Paused (${paused.length})` },
          ]}
          style={styles.segmentedButtons}
        />

        <Divider style={styles.divider} />

        {/* Content */}
        <View style={styles.listContainer}>
          {getActiveData().length === 0
            ? renderEmptyState()
            : getActiveData().map(renderRecurringCard)}
        </View>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    elevation: 1,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  summaryValue: {
    fontWeight: '600',
    color: '#212121',
  },
  summaryLabel: {
    color: '#757575',
  },
  detectButton: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  segmentedButtons: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  divider: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 12,
    elevation: 1,
  },
  detectedCard: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
    borderWidth: 1,
  },
  cardContent: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  merchantName: {
    fontWeight: '600',
    color: '#212121',
  },
  cardSubtext: {
    color: '#757575',
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontWeight: '600',
    color: '#F44336',
  },
  chip: {
    marginTop: 4,
    height: 20,
  },
  chipText: {
    fontSize: 10,
  },
  detectedActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  confidenceText: {
    color: '#757575',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  dismissButton: {
    borderColor: '#BDBDBD',
  },
  confirmedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginRight: -8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#757575',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  bottomPadding: {
    height: 40,
  },
});
