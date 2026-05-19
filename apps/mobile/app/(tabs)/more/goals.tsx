import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { ErrorState } from '@/components/ErrorState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useSpaces } from '@/hooks/useSpaces';
import {
  Ionicons,
  router,
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  PaperText as Text,
  Card,
  FAB,
  ProgressBar,
  Chip,
  Button,
} from '@/lib/react-native-compat';
import { apiClient } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface Goal {
  id: string;
  name: string;
  type: 'retirement' | 'education' | 'house_purchase' | 'emergency_fund' | 'travel' | 'other';
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  status: 'active' | 'paused' | 'achieved' | 'abandoned';
  currency: string;
  probability?: number;
  monthlyContribution?: number;
  icon?: string;
  color?: string;
}

const GOAL_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  retirement: 'umbrella-outline',
  education: 'school-outline',
  house_purchase: 'home-outline',
  emergency_fund: 'shield-checkmark-outline',
  travel: 'airplane-outline',
  other: 'flag-outline',
};

const GOAL_COLORS: Record<string, string> = {
  retirement: '#9C27B0',
  education: '#2196F3',
  house_purchase: '#4CAF50',
  emergency_fund: '#FF9800',
  travel: '#E91E63',
  other: '#607D8B',
};

export default function GoalsScreen() {
  const { currentSpace } = useSpaces();

  const {
    data: goals,
    isLoading,
    refetch,
    error,
  } = useQuery<Goal[]>({
    queryKey: ['goals', currentSpace?.id],
    queryFn: async () => {
      if (!currentSpace) throw new Error('No space selected');
      const response = await apiClient.get(`/goals?spaceId=${currentSpace.id}`);
      return response.data;
    },
    enabled: !!currentSpace,
  });

  const calculateProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(current / target, 1);
  };

  const calculateDaysRemaining = (targetDate: string) => {
    const target = new Date(targetDate);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (isLoading) {
    return <LoadingScreen message="Loading goals..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Goals"
        message="Unable to fetch your goals. Please try again."
        action={refetch}
        actionLabel="Retry"
      />
    );
  }

  if (!currentSpace) {
    return (
      <ErrorState
        title="No Space Selected"
        message="Please select a space to view goals"
        action={() => router.push('/spaces')}
        actionLabel="Select Space"
      />
    );
  }

  const activeGoals = goals?.filter((g) => g.status === 'active') || [];
  const achievedGoals = goals?.filter((g) => g.status === 'achieved') || [];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Goals */}
        {activeGoals.length > 0 ? (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Active Goals ({activeGoals.length})
            </Text>

            {activeGoals.map((goal) => {
              const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
              const daysRemaining = calculateDaysRemaining(goal.targetDate);
              const goalColor = goal.color || GOAL_COLORS[goal.type] || '#607D8B';

              return (
                <Card key={goal.id} style={styles.goalCard}>
                  <Card.Content>
                    {/* Goal Header */}
                    <View style={styles.goalHeader}>
                      <View style={styles.goalInfo}>
                        <View style={[styles.goalIcon, { backgroundColor: `${goalColor}20` }]}>
                          <Ionicons
                            name={GOAL_ICONS[goal.type] || 'flag-outline'}
                            size={24}
                            color={goalColor}
                          />
                        </View>
                        <View style={styles.goalDetails}>
                          <Text variant="titleMedium" style={styles.goalName}>
                            {goal.name}
                          </Text>
                          <Text variant="bodySmall" style={styles.goalType}>
                            {goal.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Text>
                        </View>
                      </View>

                      {goal.probability !== undefined && (
                        <Chip
                          mode="outlined"
                          textStyle={{
                            color:
                              goal.probability >= 70
                                ? '#4CAF50'
                                : goal.probability >= 40
                                  ? '#FF9800'
                                  : '#F44336',
                            fontSize: 12,
                          }}
                          style={[
                            styles.probabilityChip,
                            {
                              borderColor:
                                goal.probability >= 70
                                  ? '#4CAF50'
                                  : goal.probability >= 40
                                    ? '#FF9800'
                                    : '#F44336',
                            },
                          ]}
                        >
                          {goal.probability}% likely
                        </Chip>
                      )}
                    </View>

                    {/* Progress */}
                    <View style={styles.progressContainer}>
                      <View style={styles.progressHeader}>
                        <Text variant="bodySmall" style={styles.progressLabel}>
                          {formatCurrency(goal.currentAmount, goal.currency)} of{' '}
                          {formatCurrency(goal.targetAmount, goal.currency)}
                        </Text>
                        <Text variant="bodySmall" style={styles.progressPercent}>
                          {(progress * 100).toFixed(0)}%
                        </Text>
                      </View>
                      <ProgressBar
                        progress={progress}
                        color={goalColor}
                        style={styles.progressBar}
                      />
                    </View>

                    {/* Footer */}
                    <View style={styles.goalFooter}>
                      <View style={styles.goalStat}>
                        <Ionicons name="calendar-outline" size={14} color="#757575" />
                        <Text variant="bodySmall" style={styles.goalStatText}>
                          {daysRemaining} days left
                        </Text>
                      </View>

                      {goal.monthlyContribution !== undefined && (
                        <View style={styles.goalStat}>
                          <Ionicons name="trending-up" size={14} color="#757575" />
                          <Text variant="bodySmall" style={styles.goalStatText}>
                            {formatCurrency(goal.monthlyContribution, goal.currency)}/mo
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </>
        ) : (
          /* Empty State */
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={80} color="#E0E0E0" style={styles.emptyIcon} />
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              No Goals Yet
            </Text>
            <Text variant="bodyLarge" style={styles.emptyMessage}>
              Set financial goals to track your progress and stay motivated
            </Text>
            <Button
              mode="contained"
              onPress={() => router.push('/goals/create')}
              style={styles.createButton}
              contentStyle={styles.buttonContent}
            >
              Create Your First Goal
            </Button>
          </View>
        )}

        {/* Achieved Goals */}
        {achievedGoals.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Achieved Goals ({achievedGoals.length})
            </Text>

            {achievedGoals.map((goal) => {
              const goalColor = goal.color || GOAL_COLORS[goal.type] || '#607D8B';

              return (
                <Card key={goal.id} style={[styles.goalCard, styles.achievedCard]}>
                  <Card.Content>
                    <View style={styles.goalHeader}>
                      <View style={styles.goalInfo}>
                        <View style={[styles.goalIcon, { backgroundColor: '#E8F5E8' }]}>
                          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        </View>
                        <View style={styles.goalDetails}>
                          <Text variant="titleMedium" style={styles.goalName}>
                            {goal.name}
                          </Text>
                          <Text variant="bodySmall" style={styles.achievedText}>
                            {formatCurrency(goal.targetAmount, goal.currency)} achieved
                          </Text>
                        </View>
                      </View>
                      <Chip mode="flat" style={styles.achievedChip}>
                        Achieved
                      </Chip>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB */}
      {activeGoals.length > 0 && (
        <FAB icon="plus" style={styles.fab} onPress={() => router.push('/goals/create')} />
      )}
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
    paddingBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  goalCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 1,
  },
  achievedCard: {
    opacity: 0.8,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  goalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalDetails: {
    flex: 1,
  },
  goalName: {
    color: '#212121',
    fontWeight: '600',
    marginBottom: 2,
  },
  goalType: {
    color: '#757575',
    textTransform: 'capitalize',
  },
  probabilityChip: {
    backgroundColor: 'transparent',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#757575',
  },
  progressPercent: {
    color: '#212121',
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  goalFooter: {
    flexDirection: 'row',
    gap: 16,
  },
  goalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalStatText: {
    color: '#757575',
  },
  achievedText: {
    color: '#4CAF50',
  },
  achievedChip: {
    backgroundColor: '#E8F5E8',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#212121',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#757575',
    marginBottom: 32,
    lineHeight: 24,
  },
  createButton: {
    paddingHorizontal: 24,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
  },
  bottomPadding: {
    height: 100,
  },
});
