import React, { useState, useCallback, useMemo } from 'react';
import { RefreshControl, Alert, TextInput as RNTextInput } from 'react-native';

import {
  useAllocationStatus,
  useCreateIncomeEvent,
  useAllocateFunds,
  useAutoAllocate,
  CategoryAllocationStatus,
} from '@/hooks/api/useZeroBased';
import { useSpaces } from '@/hooks/useSpaces';
import {
  Ionicons,
  View,
  ScrollView,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  IconButton,
  ProgressBar,
  ActivityIndicator,
  Divider,
  Portal,
  Dialog,
  TextInput,
} from '@/lib/react-native-compat';

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthDisplay(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getMonthOffset(month: string, offset: number): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1 + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function ZeroBasedBudgetScreen() {
  const { currentSpace } = useSpaces();
  const currency = currentSpace?.currency || 'USD';

  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [refreshing, setRefreshing] = useState(false);
  const [showAddIncomeDialog, setShowAddIncomeDialog] = useState(false);
  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryAllocationStatus | null>(null);

  // Form state
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState('');
  const [allocateAmount, setAllocateAmount] = useState('');

  const { data: allocationStatus, isLoading, refetch } = useAllocationStatus(currentMonth);

  const createIncomeMutation = useCreateIncomeEvent();
  const allocateMutation = useAllocateFunds();
  const autoAllocateMutation = useAutoAllocate();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePreviousMonth = () => {
    setCurrentMonth(getMonthOffset(currentMonth, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(getMonthOffset(currentMonth, 1));
  };

  const handleAddIncome = async () => {
    const amount = parseFloat(incomeAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!incomeSource.trim()) {
      Alert.alert('Error', 'Please enter an income source');
      return;
    }

    try {
      await createIncomeMutation.mutateAsync({
        amount,
        currency,
        source: incomeSource.trim(),
        receivedAt: new Date().toISOString(),
      });
      setShowAddIncomeDialog(false);
      setIncomeAmount('');
      setIncomeSource('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add income');
    }
  };

  const handleAllocate = async () => {
    if (!selectedCategory) return;

    const amount = parseFloat(allocateAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      await allocateMutation.mutateAsync({
        categoryId: selectedCategory.categoryId,
        amount,
      });
      setShowAllocateDialog(false);
      setAllocateAmount('');
      setSelectedCategory(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to allocate funds');
    }
  };

  const handleAutoAllocate = async () => {
    try {
      await autoAllocateMutation.mutateAsync();
      Alert.alert('Success', 'Funds auto-allocated to categories');
    } catch (error) {
      Alert.alert('Error', 'Failed to auto-allocate');
    }
  };

  const openAllocateDialog = (category: CategoryAllocationStatus) => {
    setSelectedCategory(category);
    setAllocateAmount('');
    setShowAllocateDialog(true);
  };

  const unallocatedAmount = useMemo(() => allocationStatus?.unallocated || 0, [allocationStatus]);
  const hasUnallocated = unallocatedAmount > 0;

  if (!currentSpace) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="wallet-outline" size={48} color="#BDBDBD" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No space selected
        </Text>
        <Text variant="bodyMedium" style={styles.emptyDescription}>
          Please select a space to view your budget
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading your budget...
        </Text>
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
        {/* Month Selector */}
        <Card style={styles.monthCard}>
          <Card.Content style={styles.monthContent}>
            <IconButton icon="chevron-back" size={24} onPress={handlePreviousMonth} />
            <Text variant="titleMedium" style={styles.monthText}>
              {formatMonthDisplay(currentMonth)}
            </Text>
            <IconButton
              icon="chevron-forward"
              size={24}
              onPress={handleNextMonth}
              disabled={currentMonth >= getCurrentMonth()}
            />
          </Card.Content>
        </Card>

        {/* Ready to Assign Banner */}
        <Card style={[styles.bannerCard, hasUnallocated && styles.bannerCardHighlight]}>
          <Card.Content>
            <View style={styles.bannerHeader}>
              <View>
                <Text variant="bodySmall" style={styles.bannerLabel}>
                  Ready to Assign
                </Text>
                <Text
                  variant="headlineMedium"
                  style={[styles.bannerAmount, hasUnallocated && styles.bannerAmountHighlight]}
                >
                  {formatCurrency(unallocatedAmount, currency)}
                </Text>
              </View>
              <View style={styles.bannerStats}>
                <View style={styles.bannerStat}>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Income
                  </Text>
                  <Text variant="bodyMedium" style={styles.statValue}>
                    {formatCurrency(allocationStatus?.totalIncome || 0, currency)}
                  </Text>
                </View>
                <View style={styles.bannerStat}>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Allocated
                  </Text>
                  <Text variant="bodyMedium" style={styles.statValue}>
                    {formatCurrency(allocationStatus?.totalAllocated || 0, currency)}
                  </Text>
                </View>
              </View>
            </View>

            {hasUnallocated && (
              <View style={styles.bannerActions}>
                <Button
                  mode="contained"
                  compact
                  onPress={handleAutoAllocate}
                  loading={autoAllocateMutation.isPending}
                  buttonColor="#4CAF50"
                  style={styles.actionButton}
                >
                  Auto-Allocate
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => setShowAddIncomeDialog(true)}
                  style={styles.actionButton}
                >
                  Add Income
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Category List */}
        <Card style={styles.categoriesCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Categories
            </Text>
            {allocationStatus?.categories.map((category, index) => (
              <React.Fragment key={category.categoryId}>
                <View style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text variant="bodyLarge" style={styles.categoryName}>
                      {category.categoryName}
                    </Text>
                    <View style={styles.categoryAmounts}>
                      <Text variant="bodySmall" style={styles.spentText}>
                        Spent: {formatCurrency(category.spent, currency)}
                      </Text>
                      <Text variant="bodySmall" style={styles.availableText}>
                        Available:{' '}
                        <Text
                          style={[
                            styles.availableValue,
                            category.isOverspent && styles.overspentValue,
                          ]}
                        >
                          {formatCurrency(category.available, currency)}
                        </Text>
                      </Text>
                    </View>
                    {category.goalTarget && (
                      <ProgressBar
                        progress={Math.min((category.goalProgress || 0) / 100, 1)}
                        color={category.isOverspent ? '#F44336' : '#4CAF50'}
                        style={styles.progressBar}
                      />
                    )}
                  </View>
                  <View style={styles.categoryActions}>
                    <Text variant="titleMedium" style={styles.allocatedAmount}>
                      {formatCurrency(category.allocated, currency)}
                    </Text>
                    {hasUnallocated && (
                      <IconButton
                        icon="add-circle-outline"
                        size={20}
                        onPress={() => openAllocateDialog(category)}
                        iconColor="#4CAF50"
                      />
                    )}
                  </View>
                </View>
                {index < (allocationStatus?.categories.length || 0) - 1 && (
                  <Divider style={styles.divider} />
                )}
              </React.Fragment>
            ))}

            {(!allocationStatus?.categories || allocationStatus.categories.length === 0) && (
              <View style={styles.noCategoriesState}>
                <Ionicons name="folder-outline" size={32} color="#BDBDBD" />
                <Text variant="bodyMedium" style={styles.noCategoriesText}>
                  No budget categories yet
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Add Income Dialog */}
      <Portal>
        <Dialog visible={showAddIncomeDialog} onDismiss={() => setShowAddIncomeDialog(false)}>
          <Dialog.Title>Add Income</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Amount"
              value={incomeAmount}
              onChangeText={setIncomeAmount}
              keyboardType="decimal-pad"
              style={styles.dialogInput}
              mode="outlined"
            />
            <TextInput
              label="Source"
              value={incomeSource}
              onChangeText={setIncomeSource}
              placeholder="e.g., Salary, Freelance"
              style={styles.dialogInput}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddIncomeDialog(false)}>Cancel</Button>
            <Button onPress={handleAddIncome} loading={createIncomeMutation.isPending}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Allocate Dialog */}
        <Dialog visible={showAllocateDialog} onDismiss={() => setShowAllocateDialog(false)}>
          <Dialog.Title>Allocate to {selectedCategory?.categoryName}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogSubtext}>
              Available to assign: {formatCurrency(unallocatedAmount, currency)}
            </Text>
            <TextInput
              label="Amount"
              value={allocateAmount}
              onChangeText={setAllocateAmount}
              keyboardType="decimal-pad"
              style={styles.dialogInput}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAllocateDialog(false)}>Cancel</Button>
            <Button onPress={handleAllocate} loading={allocateMutation.isPending}>
              Allocate
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  scrollView: {
    flex: 1,
  },
  monthCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 1,
  },
  monthContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  monthText: {
    fontWeight: '600',
    color: '#212121',
  },
  bannerCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 1,
  },
  bannerCardHighlight: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bannerLabel: {
    color: '#757575',
  },
  bannerAmount: {
    fontWeight: '700',
    color: '#212121',
    marginTop: 4,
  },
  bannerAmountHighlight: {
    color: '#2E7D32',
  },
  bannerStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  bannerStat: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statLabel: {
    color: '#757575',
  },
  statValue: {
    fontWeight: '600',
    color: '#212121',
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
  },
  categoriesCard: {
    margin: 16,
    marginTop: 8,
    elevation: 1,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  categoryInfo: {
    flex: 1,
    marginRight: 16,
  },
  categoryName: {
    fontWeight: '600',
    color: '#212121',
  },
  categoryAmounts: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  spentText: {
    color: '#757575',
  },
  availableText: {
    color: '#757575',
  },
  availableValue: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  overspentValue: {
    color: '#F44336',
  },
  progressBar: {
    marginTop: 8,
    height: 4,
    borderRadius: 2,
  },
  categoryActions: {
    alignItems: 'flex-end',
  },
  allocatedAmount: {
    fontWeight: '600',
    color: '#212121',
  },
  divider: {
    marginVertical: 0,
  },
  noCategoriesState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noCategoriesText: {
    color: '#757575',
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
  },
  emptyDescription: {
    color: '#757575',
    marginTop: 8,
  },
  dialogInput: {
    marginTop: 8,
  },
  dialogSubtext: {
    color: '#757575',
    marginBottom: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
