import React, { useState, useCallback } from 'react';
import { ScrollView, RefreshControl, Alert } from 'react-native';

import {
  useSimulateRetirement,
  RetirementConfig,
  RetirementSimulationResult,
} from '@/hooks/api/useRetirement';
import { useAuth } from '@/hooks/useAuth';
import { useSpaces } from '@/hooks/useSpaces';
import {
  Ionicons,
  View,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  TextInput,
  ActivityIndicator,
  Divider,
  SegmentedButtons,
  router,
} from '@/lib/react-native-compat';

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

const RISK_PROFILES: Record<
  RiskTolerance,
  { expectedReturn: number; volatility: number; label: string }
> = {
  conservative: { expectedReturn: 0.05, volatility: 0.08, label: 'Conservative' },
  moderate: { expectedReturn: 0.07, volatility: 0.12, label: 'Moderate' },
  aggressive: { expectedReturn: 0.09, volatility: 0.18, label: 'Aggressive' },
};

export default function RetirementScreen() {
  const { currentSpace } = useSpaces();
  const { user } = useAuth();
  const currency = currentSpace?.currency || 'USD';
  const isPremium = user?.subscriptionTier === 'pro';

  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [currentAge, setCurrentAge] = useState('35');
  const [retirementAge, setRetirementAge] = useState('65');
  const [lifeExpectancy, setLifeExpectancy] = useState('90');
  const [currentSavings, setCurrentSavings] = useState('100000');
  const [monthlyContribution, setMonthlyContribution] = useState('1000');
  const [monthlyExpenses, setMonthlyExpenses] = useState('5000');
  const [socialSecurityIncome, setSocialSecurityIncome] = useState('2000');
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>('moderate');
  const [inflationAdjusted, setInflationAdjusted] = useState(true);

  // Results state
  const [result, setResult] = useState<RetirementSimulationResult | null>(null);

  const simulateMutation = useSimulateRetirement();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Reset results on refresh
    setResult(null);
    setRefreshing(false);
  }, []);

  const handleSimulate = async () => {
    const config: RetirementConfig = {
      currentAge: parseInt(currentAge) || 35,
      retirementAge: parseInt(retirementAge) || 65,
      lifeExpectancy: parseInt(lifeExpectancy) || 90,
      initialBalance: parseFloat(currentSavings) || 0,
      monthlyContribution: parseFloat(monthlyContribution) || 0,
      monthlyExpenses: parseFloat(monthlyExpenses) || 0,
      socialSecurityIncome: parseFloat(socialSecurityIncome) || 0,
      expectedReturn: RISK_PROFILES[riskTolerance].expectedReturn,
      volatility: RISK_PROFILES[riskTolerance].volatility,
      iterations: 5000,
      inflationAdjusted,
    };

    try {
      const simResult = await simulateMutation.mutateAsync(config);
      setResult(simResult);
    } catch (error) {
      Alert.alert('Error', 'Failed to run retirement simulation');
    }
  };

  if (!currentSpace) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="wallet-outline" size={48} color="#BDBDBD" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No space selected
        </Text>
        <Text variant="bodyMedium" style={styles.emptyDescription}>
          Please select a space to plan your retirement
        </Text>
      </View>
    );
  }

  // Premium gate for free users
  if (!isPremium) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.premiumContainer}>
          <Card style={styles.premiumCard}>
            <Card.Content style={styles.premiumContent}>
              <Ionicons name="lock-closed" size={64} color="#FFC107" />
              <Text variant="headlineSmall" style={styles.premiumTitle}>
                Premium Feature
              </Text>
              <Text variant="bodyMedium" style={styles.premiumDescription}>
                Retirement planning with Monte Carlo simulations is available to premium
                subscribers.
              </Text>
              <View style={styles.premiumFeatures}>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    Monte Carlo simulations (10,000+ iterations)
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    Success probability analysis
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    Personalized recommendations
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    Safe withdrawal rate calculation
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Configuration Card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Ionicons name="calculator-outline" size={24} color="#2196F3" />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Retirement Calculator
              </Text>
            </View>

            <Text variant="titleSmall" style={styles.sectionLabel}>
              Age Settings
            </Text>
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <TextInput
                  label="Current Age"
                  value={currentAge}
                  onChangeText={setCurrentAge}
                  keyboardType="number-pad"
                  mode="outlined"
                  dense
                />
              </View>
              <View style={styles.inputHalf}>
                <TextInput
                  label="Retirement Age"
                  value={retirementAge}
                  onChangeText={setRetirementAge}
                  keyboardType="number-pad"
                  mode="outlined"
                  dense
                />
              </View>
            </View>
            <TextInput
              label="Life Expectancy"
              value={lifeExpectancy}
              onChangeText={setLifeExpectancy}
              keyboardType="number-pad"
              mode="outlined"
              dense
              style={styles.input}
            />

            <Divider style={styles.divider} />

            <Text variant="titleSmall" style={styles.sectionLabel}>
              Financial Inputs
            </Text>
            <TextInput
              label="Current Savings"
              value={currentSavings}
              onChangeText={setCurrentSavings}
              keyboardType="decimal-pad"
              mode="outlined"
              dense
              left={<TextInput.Affix text="$" />}
              style={styles.input}
            />
            <TextInput
              label="Monthly Contribution"
              value={monthlyContribution}
              onChangeText={setMonthlyContribution}
              keyboardType="decimal-pad"
              mode="outlined"
              dense
              left={<TextInput.Affix text="$" />}
              style={styles.input}
            />
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <TextInput
                  label="Monthly Expenses"
                  value={monthlyExpenses}
                  onChangeText={setMonthlyExpenses}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  dense
                  left={<TextInput.Affix text="$" />}
                />
              </View>
              <View style={styles.inputHalf}>
                <TextInput
                  label="Social Security"
                  value={socialSecurityIncome}
                  onChangeText={setSocialSecurityIncome}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  dense
                  left={<TextInput.Affix text="$" />}
                />
              </View>
            </View>

            <Divider style={styles.divider} />

            <Text variant="titleSmall" style={styles.sectionLabel}>
              Risk Tolerance
            </Text>
            <SegmentedButtons
              value={riskTolerance}
              onValueChange={(value: string) => setRiskTolerance(value as RiskTolerance)}
              buttons={[
                { value: 'conservative', label: 'Low' },
                { value: 'moderate', label: 'Medium' },
                { value: 'aggressive', label: 'High' },
              ]}
              style={styles.segmentedButtons}
            />
            <Text variant="bodySmall" style={styles.riskDescription}>
              {RISK_PROFILES[riskTolerance].label}:{' '}
              {formatPercent(RISK_PROFILES[riskTolerance].expectedReturn)} expected return,{' '}
              {formatPercent(RISK_PROFILES[riskTolerance].volatility)} volatility
            </Text>

            <Button
              mode="contained"
              onPress={handleSimulate}
              loading={simulateMutation.isPending}
              disabled={simulateMutation.isPending}
              buttonColor="#2196F3"
              style={styles.simulateButton}
            >
              Run Simulation
            </Button>
          </Card.Content>
        </Card>

        {/* Results Section */}
        {simulateMutation.isPending && (
          <Card style={styles.card}>
            <Card.Content style={styles.loadingContent}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text variant="bodyMedium" style={styles.loadingText}>
                Running Monte Carlo simulation...
              </Text>
              <Text variant="bodySmall" style={styles.loadingSubtext}>
                Analyzing 5,000 possible scenarios
              </Text>
            </Card.Content>
          </Card>
        )}

        {result && (
          <>
            {/* Success Probability Card */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Ionicons name="trending-up" size={24} color="#4CAF50" />
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    Success Probability
                  </Text>
                </View>
                <View style={styles.probabilityContainer}>
                  <Text
                    variant="displayMedium"
                    style={[
                      styles.probabilityValue,
                      result.withdrawalPhase.probabilityOfNotRunningOut >= 0.8
                        ? styles.successHigh
                        : result.withdrawalPhase.probabilityOfNotRunningOut >= 0.6
                          ? styles.successMedium
                          : styles.successLow,
                    ]}
                  >
                    {formatPercent(result.withdrawalPhase.probabilityOfNotRunningOut)}
                  </Text>
                  <Text variant="bodyMedium" style={styles.probabilityLabel}>
                    chance your savings will last through retirement
                  </Text>
                </View>
              </Card.Content>
            </Card>

            {/* Accumulation Phase Card */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Ionicons name="trending-up-outline" size={24} color="#2196F3" />
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    Accumulation Phase
                  </Text>
                </View>
                <Text variant="bodySmall" style={styles.phaseSubtitle}>
                  {result.accumulationPhase.yearsToRetirement} years until retirement
                </Text>

                <View style={styles.resultRow}>
                  <Text variant="bodyMedium" style={styles.resultLabel}>
                    Projected Balance at Retirement
                  </Text>
                  <Text variant="titleMedium" style={styles.resultValue}>
                    {formatCurrency(result.accumulationPhase.finalBalanceMedian, currency)}
                  </Text>
                </View>
                <View style={styles.rangeRow}>
                  <Text variant="bodySmall" style={styles.rangeLabel}>
                    10th percentile:{' '}
                    {formatCurrency(result.accumulationPhase.finalBalanceP10, currency)}
                  </Text>
                  <Text variant="bodySmall" style={styles.rangeLabel}>
                    90th percentile:{' '}
                    {formatCurrency(result.accumulationPhase.finalBalanceP90, currency)}
                  </Text>
                </View>
                <Divider style={styles.resultDivider} />
                <View style={styles.resultRow}>
                  <Text variant="bodyMedium" style={styles.resultLabel}>
                    Total Contributions
                  </Text>
                  <Text variant="bodyMedium" style={styles.resultValue}>
                    {formatCurrency(result.accumulationPhase.totalContributions, currency)}
                  </Text>
                </View>
              </Card.Content>
            </Card>

            {/* Withdrawal Phase Card */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Ionicons name="trending-down-outline" size={24} color="#FF9800" />
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    Withdrawal Phase
                  </Text>
                </View>
                <Text variant="bodySmall" style={styles.phaseSubtitle}>
                  {result.withdrawalPhase.yearsInRetirement} years in retirement
                </Text>

                <View style={styles.resultRow}>
                  <Text variant="bodyMedium" style={styles.resultLabel}>
                    Net Monthly Need
                  </Text>
                  <Text variant="titleMedium" style={styles.resultValue}>
                    {formatCurrency(result.withdrawalPhase.netMonthlyNeed, currency)}
                  </Text>
                </View>
                <Text variant="bodySmall" style={styles.noteText}>
                  After Social Security income
                </Text>
                <Divider style={styles.resultDivider} />
                <View style={styles.resultRow}>
                  <Text variant="bodyMedium" style={styles.resultLabel}>
                    Safe Withdrawal Rate (4% rule)
                  </Text>
                  <Text variant="bodyMedium" style={styles.resultValue}>
                    {formatCurrency(result.withdrawalPhase.safeWithdrawalRate, currency)}/mo
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text variant="bodyMedium" style={styles.resultLabel}>
                    Median Sustainability
                  </Text>
                  <Text variant="bodyMedium" style={styles.resultValue}>
                    {Math.round(result.withdrawalPhase.medianYearsOfSustainability)} years
                  </Text>
                </View>
              </Card.Content>
            </Card>

            {/* Recommendations Card */}
            {(result.recommendations.increaseContributionBy ||
              result.recommendations.canRetireEarlierBy) && (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Ionicons name="bulb-outline" size={24} color="#9C27B0" />
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      Recommendations
                    </Text>
                  </View>

                  {result.recommendations.increaseContributionBy && (
                    <View style={styles.recommendationRow}>
                      <Ionicons name="arrow-up-circle" size={20} color="#F44336" />
                      <Text variant="bodyMedium" style={styles.recommendationText}>
                        Consider increasing monthly contribution by{' '}
                        <Text style={styles.highlightText}>
                          {formatCurrency(result.recommendations.increaseContributionBy, currency)}
                        </Text>{' '}
                        to improve your success probability
                      </Text>
                    </View>
                  )}

                  {result.recommendations.canRetireEarlierBy && (
                    <View style={styles.recommendationRow}>
                      <Ionicons name="time" size={20} color="#4CAF50" />
                      <Text variant="bodyMedium" style={styles.recommendationText}>
                        You could potentially retire{' '}
                        <Text style={styles.highlightText}>
                          {result.recommendations.canRetireEarlierBy} years earlier
                        </Text>{' '}
                        based on your current savings rate
                      </Text>
                    </View>
                  )}

                  <Divider style={styles.resultDivider} />
                  <View style={styles.resultRow}>
                    <Text variant="bodyMedium" style={styles.resultLabel}>
                      Target Nest Egg
                    </Text>
                    <Text variant="titleMedium" style={styles.targetValue}>
                      {formatCurrency(result.recommendations.targetNestEgg, currency)}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            )}
          </>
        )}

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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
  },
  emptyDescription: {
    color: '#757575',
    marginTop: 8,
    textAlign: 'center',
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
  premiumTitle: {
    fontWeight: '700',
    color: '#212121',
    marginTop: 16,
  },
  premiumDescription: {
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 16,
  },
  premiumFeatures: {
    marginTop: 24,
    gap: 12,
    alignSelf: 'stretch',
    paddingHorizontal: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    flex: 1,
    color: '#424242',
  },
  upgradeButton: {
    marginTop: 24,
    paddingHorizontal: 32,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  sectionLabel: {
    fontWeight: '600',
    color: '#424242',
    marginTop: 8,
    marginBottom: 12,
  },
  input: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputHalf: {
    flex: 1,
  },
  divider: {
    marginVertical: 16,
  },
  segmentedButtons: {
    marginTop: 8,
  },
  riskDescription: {
    color: '#757575',
    marginTop: 8,
    textAlign: 'center',
  },
  simulateButton: {
    marginTop: 20,
  },
  loadingContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#424242',
  },
  loadingSubtext: {
    marginTop: 4,
    color: '#757575',
  },
  probabilityContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  probabilityValue: {
    fontWeight: '700',
  },
  successHigh: {
    color: '#4CAF50',
  },
  successMedium: {
    color: '#FF9800',
  },
  successLow: {
    color: '#F44336',
  },
  probabilityLabel: {
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
  },
  phaseSubtitle: {
    color: '#757575',
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultLabel: {
    color: '#424242',
    flex: 1,
  },
  resultValue: {
    fontWeight: '600',
    color: '#212121',
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rangeLabel: {
    color: '#9E9E9E',
    fontSize: 12,
  },
  resultDivider: {
    marginVertical: 12,
  },
  noteText: {
    color: '#9E9E9E',
    marginTop: -4,
    marginBottom: 8,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  recommendationText: {
    flex: 1,
    color: '#424242',
  },
  highlightText: {
    fontWeight: '700',
    color: '#2196F3',
  },
  targetValue: {
    fontWeight: '700',
    color: '#9C27B0',
  },
  bottomPadding: {
    height: 40,
  },
});
