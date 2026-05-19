import React, { useState, useCallback } from 'react';
import { RefreshControl, Alert } from 'react-native';

import {
  useGenerateProjection,
  ProjectionResult,
  CreateProjectionDto,
} from '@/hooks/api/useProjections';
import { useSpaces } from '@/hooks/useSpaces';
import { useAuth } from '@/hooks/useAuth';
import {
  Ionicons,
  View,
  ScrollView,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  Divider,
  ActivityIndicator,
  Portal,
  Dialog,
  TextInput,
  router,
} from '@/lib/react-native-compat';

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getRiskColor(score: number): string {
  if (score < 30) return '#4CAF50';
  if (score < 60) return '#FF9800';
  return '#F44336';
}

function getRiskLabel(score: number): string {
  if (score < 30) return 'Low Risk';
  if (score < 60) return 'Moderate Risk';
  return 'High Risk';
}

const DEFAULT_CONFIG: CreateProjectionDto = {
  projectionYears: 30,
  inflationRate: 0.03,
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  includeAccounts: true,
  includeRecurring: true,
  lifeEvents: [],
};

export default function ProjectionsScreen() {
  const { currentSpace } = useSpaces();
  const { user } = useAuth();
  const isPremium = user?.subscriptionTier === 'pro';
  const currency = currentSpace?.currency || 'USD';

  const [projection, setProjection] = useState<ProjectionResult | null>(null);
  const [config, setConfig] = useState<CreateProjectionDto>(DEFAULT_CONFIG);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form state for config dialog
  const [formCurrentAge, setFormCurrentAge] = useState(String(config.currentAge));
  const [formRetirementAge, setFormRetirementAge] = useState(String(config.retirementAge));
  const [formYears, setFormYears] = useState(String(config.projectionYears));

  const generateMutation = useGenerateProjection();

  const handleGenerate = useCallback(async () => {
    try {
      const result = await generateMutation.mutateAsync(config);
      setProjection(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate projection. Please try again.');
    }
  }, [config, generateMutation]);

  const onRefresh = useCallback(async () => {
    if (!projection) return;
    setRefreshing(true);
    await handleGenerate();
    setRefreshing(false);
  }, [projection, handleGenerate]);

  const handleSaveConfig = () => {
    const currentAge = parseInt(formCurrentAge) || 35;
    const retirementAge = parseInt(formRetirementAge) || 65;
    const years = parseInt(formYears) || 30;

    setConfig({
      ...config,
      currentAge: Math.max(18, Math.min(80, currentAge)),
      retirementAge: Math.max(currentAge + 5, Math.min(100, retirementAge)),
      projectionYears: Math.max(5, Math.min(50, years)),
    });
    setShowConfigDialog(false);
  };

  const openConfigDialog = () => {
    setFormCurrentAge(String(config.currentAge));
    setFormRetirementAge(String(config.retirementAge));
    setFormYears(String(config.projectionYears));
    setShowConfigDialog(true);
  };

  if (!currentSpace) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="trending-up-outline" size={48} color="#BDBDBD" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No space selected
        </Text>
        <Text variant="bodyMedium" style={styles.emptyDescription}>
          Please select a space to view projections
        </Text>
      </View>
    );
  }

  if (!isPremium) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.premiumContainer}>
          <Card style={styles.premiumCard}>
            <Card.Content style={styles.premiumContent}>
              <View style={styles.premiumIcon}>
                <Ionicons name="lock-closed" size={48} color="#4CAF50" />
              </View>
              <Text variant="headlineSmall" style={styles.premiumTitle}>
                Premium Feature
              </Text>
              <Text variant="bodyMedium" style={styles.premiumDescription}>
                Long-term financial projections with Monte Carlo simulations are available to
                Premium members.
              </Text>
              <View style={styles.premiumFeatures}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    30-year wealth projections
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    Monte Carlo simulations
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    Retirement readiness analysis
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    What-if scenario planning
                  </Text>
                </View>
              </View>
              <Button
                mode="contained"
                buttonColor="#4CAF50"
                style={styles.upgradeButton}
                onPress={() => router.push('/more/billing')}
              >
                Upgrade to Premium
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          projection ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {/* Configuration Card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.configHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Projection Settings
              </Text>
              <Button mode="text" compact onPress={openConfigDialog}>
                Edit
              </Button>
            </View>
            <View style={styles.configGrid}>
              <View style={styles.configItem}>
                <Text variant="bodySmall" style={styles.configLabel}>
                  Current Age
                </Text>
                <Text variant="titleMedium" style={styles.configValue}>
                  {config.currentAge}
                </Text>
              </View>
              <View style={styles.configItem}>
                <Text variant="bodySmall" style={styles.configLabel}>
                  Retirement Age
                </Text>
                <Text variant="titleMedium" style={styles.configValue}>
                  {config.retirementAge}
                </Text>
              </View>
              <View style={styles.configItem}>
                <Text variant="bodySmall" style={styles.configLabel}>
                  Years to Project
                </Text>
                <Text variant="titleMedium" style={styles.configValue}>
                  {config.projectionYears}
                </Text>
              </View>
            </View>
            <Button
              mode="contained"
              onPress={handleGenerate}
              loading={generateMutation.isPending}
              disabled={generateMutation.isPending}
              buttonColor="#4CAF50"
              style={styles.generateButton}
            >
              Generate Projection
            </Button>
          </Card.Content>
        </Card>

        {/* Results */}
        {generateMutation.isPending && !projection && (
          <Card style={styles.card}>
            <Card.Content style={styles.loadingContent}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text variant="bodyMedium" style={styles.loadingText}>
                Running Monte Carlo simulation...
              </Text>
              <Text variant="bodySmall" style={styles.loadingSubtext}>
                This may take a moment
              </Text>
            </Card.Content>
          </Card>
        )}

        {projection && (
          <>
            {/* Summary Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Projection Summary
                </Text>

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Ionicons name="wallet-outline" size={24} color="#4CAF50" />
                    <Text variant="bodySmall" style={styles.summaryLabel}>
                      Current Net Worth
                    </Text>
                    <Text variant="titleMedium" style={styles.summaryValue}>
                      {formatCurrency(projection.summary.currentNetWorth, currency)}
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Ionicons name="trending-up" size={24} color="#2196F3" />
                    <Text variant="bodySmall" style={styles.summaryLabel}>
                      Projected Net Worth
                    </Text>
                    <Text variant="titleMedium" style={styles.summaryValue}>
                      {formatCurrency(projection.summary.projectedNetWorth, currency)}
                    </Text>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Ionicons name="cash-outline" size={24} color="#FF9800" />
                    <Text variant="bodySmall" style={styles.summaryLabel}>
                      Monthly Retirement Income
                    </Text>
                    <Text variant="titleMedium" style={styles.summaryValue}>
                      {formatCurrency(projection.summary.monthlyRetirementIncome, currency)}
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Ionicons name="pie-chart-outline" size={24} color="#9C27B0" />
                    <Text variant="bodySmall" style={styles.summaryLabel}>
                      Success Probability
                    </Text>
                    <Text variant="titleMedium" style={styles.summaryValue}>
                      {formatPercent(projection.summary.successProbability)}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Risk Assessment */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Risk Assessment
                </Text>
                <View style={styles.riskContainer}>
                  <View
                    style={[
                      styles.riskIndicator,
                      { backgroundColor: getRiskColor(projection.summary.riskScore) },
                    ]}
                  >
                    <Text style={styles.riskScore}>{Math.round(projection.summary.riskScore)}</Text>
                  </View>
                  <View style={styles.riskInfo}>
                    <Text
                      variant="titleMedium"
                      style={[
                        styles.riskLabel,
                        { color: getRiskColor(projection.summary.riskScore) },
                      ]}
                    >
                      {getRiskLabel(projection.summary.riskScore)}
                    </Text>
                    <Text variant="bodySmall" style={styles.riskDescription}>
                      Based on your savings rate, investment allocation, and retirement timeline
                    </Text>
                  </View>
                </View>

                {projection.summary.savingsGap > 0 && (
                  <View style={styles.gapWarning}>
                    <Ionicons name="warning-outline" size={20} color="#FF9800" />
                    <Text variant="bodyMedium" style={styles.gapText}>
                      Savings gap:{' '}
                      <Text style={styles.gapAmount}>
                        {formatCurrency(projection.summary.savingsGap, currency)}
                      </Text>
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Milestones */}
            {projection.milestones && projection.milestones.length > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Key Milestones
                  </Text>
                  {projection.milestones.map((milestone, index) => (
                    <View key={index} style={styles.milestoneItem}>
                      <View style={styles.milestoneYear}>
                        <Text variant="bodySmall" style={styles.milestoneYearText}>
                          {milestone.year}
                        </Text>
                      </View>
                      <View style={styles.milestoneInfo}>
                        <Text variant="bodyMedium" style={styles.milestoneEvent}>
                          {milestone.event}
                        </Text>
                        <Text
                          variant="bodySmall"
                          style={[
                            styles.milestoneImpact,
                            milestone.impact >= 0 ? styles.positiveImpact : styles.negativeImpact,
                          ]}
                        >
                          {milestone.impact >= 0 ? '+' : ''}
                          {formatCurrency(milestone.impact, currency)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}
          </>
        )}

        {!projection && !generateMutation.isPending && (
          <Card style={styles.card}>
            <Card.Content style={styles.emptyResultState}>
              <Ionicons name="analytics-outline" size={48} color="#BDBDBD" />
              <Text variant="titleMedium" style={styles.emptyResultTitle}>
                Ready to project your future
              </Text>
              <Text variant="bodyMedium" style={styles.emptyResultDescription}>
                Configure your settings above and tap "Generate Projection" to see your long-term
                financial outlook
              </Text>
            </Card.Content>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Config Dialog */}
      <Portal>
        <Dialog visible={showConfigDialog} onDismiss={() => setShowConfigDialog(false)}>
          <Dialog.Title>Projection Settings</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Current Age"
              value={formCurrentAge}
              onChangeText={setFormCurrentAge}
              keyboardType="number-pad"
              style={styles.dialogInput}
              mode="outlined"
            />
            <TextInput
              label="Retirement Age"
              value={formRetirementAge}
              onChangeText={setFormRetirementAge}
              keyboardType="number-pad"
              style={styles.dialogInput}
              mode="outlined"
            />
            <TextInput
              label="Years to Project"
              value={formYears}
              onChangeText={setFormYears}
              keyboardType="number-pad"
              style={styles.dialogInput}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowConfigDialog(false)}>Cancel</Button>
            <Button onPress={handleSaveConfig}>Save</Button>
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
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 0,
    elevation: 1,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  configGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  configItem: {
    flex: 1,
    alignItems: 'center',
  },
  configLabel: {
    color: '#757575',
  },
  configValue: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 4,
  },
  generateButton: {
    marginTop: 16,
  },
  loadingContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#212121',
  },
  loadingSubtext: {
    marginTop: 4,
    color: '#757575',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    color: '#757575',
    marginTop: 8,
    textAlign: 'center',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  riskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  riskIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskScore: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  riskInfo: {
    flex: 1,
  },
  riskLabel: {
    fontWeight: '600',
  },
  riskDescription: {
    color: '#757575',
    marginTop: 4,
  },
  gapWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
  },
  gapText: {
    color: '#E65100',
  },
  gapAmount: {
    fontWeight: '600',
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  milestoneYear: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneYearText: {
    fontWeight: '600',
    color: '#4CAF50',
    fontSize: 12,
  },
  milestoneInfo: {
    flex: 1,
    marginLeft: 12,
  },
  milestoneEvent: {
    fontWeight: '600',
    color: '#212121',
  },
  milestoneImpact: {
    marginTop: 2,
  },
  positiveImpact: {
    color: '#4CAF50',
  },
  negativeImpact: {
    color: '#F44336',
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
  emptyResultState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyResultTitle: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
  },
  emptyResultDescription: {
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  premiumContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  premiumCard: {
    elevation: 2,
  },
  premiumContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  premiumIcon: {
    marginBottom: 16,
  },
  premiumTitle: {
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  premiumDescription: {
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
  },
  premiumFeatures: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  featureText: {
    color: '#212121',
  },
  upgradeButton: {
    width: '100%',
  },
  dialogInput: {
    marginTop: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
