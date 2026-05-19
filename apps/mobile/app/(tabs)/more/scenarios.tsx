import React, { useState, useCallback } from 'react';
import { ScrollView, RefreshControl, Alert } from 'react-native';

import {
  useAnalyzeScenario,
  SCENARIOS,
  ScenarioType,
  ScenarioComparisonResult,
} from '@/hooks/api/useScenarios';
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
  Menu,
  Chip,
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

const SEVERITY_COLORS: Record<string, string> = {
  low: '#FFC107',
  medium: '#FF9800',
  high: '#F44336',
  extreme: '#9C27B0',
  positive: '#4CAF50',
};

export default function ScenariosScreen() {
  const { currentSpace } = useSpaces();
  const { user } = useAuth();
  const currency = currentSpace?.currency || 'USD';
  const isPremium = user?.subscriptionTier === 'pro';

  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [initialBalance, setInitialBalance] = useState('100000');
  const [monthlyContribution, setMonthlyContribution] = useState('1000');
  const [years, setYears] = useState('10');
  const [expectedReturn, setExpectedReturn] = useState('7');
  const [volatility, setVolatility] = useState('15');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('GREAT_RECESSION');
  const [menuVisible, setMenuVisible] = useState(false);

  // Results state
  const [result, setResult] = useState<ScenarioComparisonResult | null>(null);

  const analyzeMutation = useAnalyzeScenario();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setResult(null);
    setRefreshing(false);
  }, []);

  const handleAnalyze = async () => {
    const config = {
      initialBalance: parseFloat(initialBalance) || 100000,
      monthlyContribution: parseFloat(monthlyContribution) || 1000,
      years: parseInt(years) || 10,
      expectedReturn: (parseFloat(expectedReturn) || 7) / 100,
      returnVolatility: (parseFloat(volatility) || 15) / 100,
      iterations: 5000,
    };

    try {
      const analysisResult = await analyzeMutation.mutateAsync({
        scenarioType: selectedScenario,
        config,
      });
      setResult(analysisResult);
    } catch (error) {
      Alert.alert('Error', 'Failed to run scenario analysis');
    }
  };

  const selectedScenarioInfo = SCENARIOS.find((s) => s.value === selectedScenario);

  if (!currentSpace) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="wallet-outline" size={48} color="#BDBDBD" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No space selected
        </Text>
        <Text variant="bodyMedium" style={styles.emptyDescription}>
          Please select a space to run scenario analysis
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
                Scenario analysis and stress testing is available to premium subscribers.
              </Text>
              <View style={styles.premiumFeatures}>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    12+ historical market scenarios
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    Monte Carlo stress testing
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    Portfolio impact analysis
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text variant="bodyMedium" style={styles.featureText}>
                    Recovery time estimates
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
              <Ionicons name="trending-down-outline" size={24} color="#F44336" />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Scenario Configuration
              </Text>
            </View>

            <Text variant="bodySmall" style={styles.infoText}>
              Stress test your portfolio against historical market events
            </Text>

            <Text variant="titleSmall" style={styles.sectionLabel}>
              Portfolio Settings
            </Text>
            <TextInput
              label="Initial Balance"
              value={initialBalance}
              onChangeText={setInitialBalance}
              keyboardType="decimal-pad"
              mode="outlined"
              dense
              left={<TextInput.Affix text="$" />}
              style={styles.input}
            />
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <TextInput
                  label="Monthly Contribution"
                  value={monthlyContribution}
                  onChangeText={setMonthlyContribution}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  dense
                  left={<TextInput.Affix text="$" />}
                />
              </View>
              <View style={styles.inputHalf}>
                <TextInput
                  label="Time Horizon (years)"
                  value={years}
                  onChangeText={setYears}
                  keyboardType="number-pad"
                  mode="outlined"
                  dense
                />
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <TextInput
                  label="Expected Return (%)"
                  value={expectedReturn}
                  onChangeText={setExpectedReturn}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  dense
                />
              </View>
              <View style={styles.inputHalf}>
                <TextInput
                  label="Volatility (%)"
                  value={volatility}
                  onChangeText={setVolatility}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  dense
                />
              </View>
            </View>

            <Divider style={styles.divider} />

            <Text variant="titleSmall" style={styles.sectionLabel}>
              Select Scenario
            </Text>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setMenuVisible(true)}
                  contentStyle={styles.scenarioButtonContent}
                  style={styles.scenarioButton}
                >
                  <View style={styles.scenarioButtonInner}>
                    <Text>{selectedScenarioInfo?.label || 'Select Scenario'}</Text>
                    {selectedScenarioInfo && (
                      <Chip
                        compact
                        style={[
                          styles.severityChip,
                          { backgroundColor: SEVERITY_COLORS[selectedScenarioInfo.severity] },
                        ]}
                        textStyle={styles.severityChipText}
                      >
                        {selectedScenarioInfo.severity}
                      </Chip>
                    )}
                  </View>
                </Button>
              }
            >
              {SCENARIOS.map((scenario) => (
                <Menu.Item
                  key={scenario.value}
                  onPress={() => {
                    setSelectedScenario(scenario.value);
                    setMenuVisible(false);
                  }}
                  title={
                    <View style={styles.menuItemContent}>
                      <Text>{scenario.label}</Text>
                      <View
                        style={[
                          styles.severityDot,
                          { backgroundColor: SEVERITY_COLORS[scenario.severity] },
                        ]}
                      />
                    </View>
                  }
                />
              ))}
            </Menu>

            <Button
              mode="contained"
              onPress={handleAnalyze}
              loading={analyzeMutation.isPending}
              disabled={analyzeMutation.isPending}
              buttonColor="#F44336"
              style={styles.analyzeButton}
            >
              Run Stress Test
            </Button>
          </Card.Content>
        </Card>

        {/* Loading State */}
        {analyzeMutation.isPending && (
          <Card style={styles.card}>
            <Card.Content style={styles.loadingContent}>
              <ActivityIndicator size="large" color="#F44336" />
              <Text variant="bodyMedium" style={styles.loadingText}>
                Running stress test...
              </Text>
              <Text variant="bodySmall" style={styles.loadingSubtext}>
                Simulating market conditions
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Impact Summary Card */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Ionicons name="warning" size={24} color="#F44336" />
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    {result.scenarioName}
                  </Text>
                </View>
                <Text variant="bodySmall" style={styles.scenarioDescription}>
                  {result.scenarioDescription}
                </Text>

                {result.comparison.worthStressTesting && (
                  <View style={styles.alertBox}>
                    <Ionicons name="alert-circle" size={20} color="#F44336" />
                    <Text variant="bodyMedium" style={styles.alertText}>
                      Significant impact:{' '}
                      {formatCurrency(Math.abs(result.comparison.medianDifference), currency)} loss
                      ({Math.abs(result.comparison.medianDifferencePercent).toFixed(1)}%)
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Comparison Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Portfolio Comparison
                </Text>

                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonColumn}>
                    <Text variant="titleSmall" style={styles.comparisonHeader}>
                      Baseline (Normal)
                    </Text>
                    <View style={styles.comparisonValue}>
                      <Text variant="bodySmall" style={styles.comparisonLabel}>
                        Median
                      </Text>
                      <Text variant="titleMedium" style={styles.baselineValue}>
                        {formatCurrency(result.baseline.median, currency)}
                      </Text>
                    </View>
                    <View style={styles.comparisonValue}>
                      <Text variant="bodySmall" style={styles.comparisonLabel}>
                        P10 - P90
                      </Text>
                      <Text variant="bodySmall" style={styles.rangeText}>
                        {formatCurrency(result.baseline.p10, currency)} -{' '}
                        {formatCurrency(result.baseline.p90, currency)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.vsContainer}>
                    <Text variant="labelMedium" style={styles.vsText}>
                      vs
                    </Text>
                  </View>

                  <View style={styles.comparisonColumn}>
                    <Text
                      variant="titleSmall"
                      style={[styles.comparisonHeader, styles.stressedHeader]}
                    >
                      With Scenario
                    </Text>
                    <View style={styles.comparisonValue}>
                      <Text variant="bodySmall" style={styles.comparisonLabel}>
                        Median
                      </Text>
                      <Text variant="titleMedium" style={styles.stressedValue}>
                        {formatCurrency(result.scenario.median || 0, currency)}
                      </Text>
                    </View>
                    <View style={styles.comparisonValue}>
                      <Text variant="bodySmall" style={styles.comparisonLabel}>
                        P10 - P90
                      </Text>
                      <Text variant="bodySmall" style={styles.rangeText}>
                        {formatCurrency(result.scenario.p10 || 0, currency)} -{' '}
                        {formatCurrency(result.scenario.p90 || 0, currency)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Impact Analysis Card */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Ionicons name="analytics-outline" size={24} color="#2196F3" />
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    Impact Analysis
                  </Text>
                </View>

                <View style={styles.impactRow}>
                  <Text variant="bodyMedium" style={styles.impactLabel}>
                    Median Impact
                  </Text>
                  <Text variant="titleMedium" style={styles.impactValueNegative}>
                    -{formatCurrency(Math.abs(result.comparison.medianDifference), currency)}
                  </Text>
                </View>
                <View style={styles.impactRow}>
                  <Text variant="bodyMedium" style={styles.impactLabel}>
                    Percentage Impact
                  </Text>
                  <Text variant="bodyMedium" style={styles.impactValueNegative}>
                    {result.comparison.medianDifferencePercent.toFixed(1)}%
                  </Text>
                </View>
                <Divider style={styles.impactDivider} />
                <View style={styles.impactRow}>
                  <Text variant="bodyMedium" style={styles.impactLabel}>
                    Worst Case Impact (P10)
                  </Text>
                  <Text variant="bodyMedium" style={styles.impactValueNegative}>
                    -{formatCurrency(Math.abs(result.comparison.p10Difference), currency)}
                  </Text>
                </View>
                <View style={styles.impactRow}>
                  <Text variant="bodyMedium" style={styles.impactLabel}>
                    Recovery Time
                  </Text>
                  <Text variant="bodyMedium" style={styles.impactValue}>
                    {result.comparison.recoveryMonths
                      ? `${result.comparison.recoveryMonths} months`
                      : 'N/A'}
                  </Text>
                </View>
                <View style={styles.impactRow}>
                  <Text variant="bodyMedium" style={styles.impactLabel}>
                    Impact Severity
                  </Text>
                  <Chip
                    compact
                    style={[
                      styles.severityChip,
                      {
                        backgroundColor:
                          result.comparison.impactSeverity === 'critical'
                            ? '#F44336'
                            : result.comparison.impactSeverity === 'significant'
                              ? '#FF9800'
                              : result.comparison.impactSeverity === 'moderate'
                                ? '#FFC107'
                                : '#4CAF50',
                      },
                    ]}
                    textStyle={styles.severityChipText}
                  >
                    {result.comparison.impactSeverity}
                  </Chip>
                </View>
              </Card.Content>
            </Card>
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
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  infoText: {
    color: '#757575',
    marginBottom: 16,
  },
  sectionLabel: {
    fontWeight: '600',
    color: '#424242',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
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
  scenarioButton: {
    marginBottom: 16,
  },
  scenarioButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scenarioButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  severityChip: {
    height: 24,
  },
  severityChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  analyzeButton: {
    marginTop: 8,
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
  scenarioDescription: {
    color: '#757575',
    marginBottom: 12,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  alertText: {
    flex: 1,
    color: '#C62828',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  comparisonColumn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  comparisonHeader: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  stressedHeader: {
    color: '#F44336',
  },
  comparisonValue: {
    marginBottom: 8,
  },
  comparisonLabel: {
    color: '#757575',
  },
  baselineValue: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  stressedValue: {
    fontWeight: '600',
    color: '#F44336',
  },
  rangeText: {
    color: '#757575',
    fontSize: 12,
  },
  vsContainer: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  vsText: {
    color: '#757575',
  },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  impactLabel: {
    color: '#424242',
  },
  impactValue: {
    fontWeight: '600',
    color: '#212121',
  },
  impactValueNegative: {
    fontWeight: '600',
    color: '#F44336',
  },
  impactDivider: {
    marginVertical: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
