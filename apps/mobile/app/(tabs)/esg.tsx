import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { ErrorState } from '@/components/ErrorState';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useSpaces } from '@/hooks/useSpaces';
import { BarChart, LineChart } from '@/lib/chart-kit-compat';
import {
  Ionicons,
  View,
  ScrollView,
  RefreshControl,
  Dimensions,
  StyleSheet,
  PaperText as Text,
  Card,
  SegmentedButtons,
  Chip,
} from '@/lib/react-native-compat';
import { apiClient } from '@/services/api';

const screenWidth = Dimensions.get('window').width;

interface ESGScore {
  symbol: string;
  name: string;
  environmental: number;
  social: number;
  governance: number;
  overall: number;
  grade: string;
  energyIntensity: number;
  category: string;
  balance: number;
  balanceUSD: number;
}

interface ESGData {
  scores: ESGScore[];
  portfolioScore: {
    environmental: number;
    social: number;
    governance: number;
    overall: number;
    grade: string;
  };
  trends: {
    date: string;
    environmental: number;
    social: number;
    governance: number;
    overall: number;
  }[];
}

export default function ESGScreen() {
  const { currentSpace } = useSpaces();
  const [selectedMetric, setSelectedMetric] = useState('overall');

  const {
    data: esgData,
    isLoading,
    refetch,
    error,
  } = useQuery<ESGData>({
    queryKey: ['esg', currentSpace?.id],
    queryFn: () => {
      if (!currentSpace) throw new Error('No space selected');
      return apiClient.get(`/esg?spaceId=${currentSpace.id}`).then((res) => res.data);
    },
    enabled: !!currentSpace,
  });

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return '#4CAF50';
      case 'B+':
      case 'B':
        return '#8BC34A';
      case 'C+':
      case 'C':
        return '#FF9800';
      case 'D+':
      case 'D':
        return '#FF5722';
      case 'F':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getMetricColor = (metric: string) => {
    switch (metric) {
      case 'environmental':
        return '#4CAF50';
      case 'social':
        return '#2196F3';
      case 'governance':
        return '#FF9800';
      default:
        return '#9C27B0';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return <LoadingScreen message="Calculating ESG scores..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load ESG Data"
        message="Unable to calculate ESG scores. Please try again."
        action={refetch}
        actionLabel="Retry"
      />
    );
  }

  if (!currentSpace) {
    return (
      <ErrorState
        title="No Space Selected"
        message="Please select a space to view ESG scores"
        actionLabel="Select Space"
      />
    );
  }

  const chartData = {
    labels: esgData?.trends?.map((t) => new Date(t.date).toLocaleDateString().slice(0, 5)) || [],
    datasets: [
      {
        data: esgData?.trends?.map((t) => t[selectedMetric as keyof typeof t] as number) || [],
        color: () => getMetricColor(selectedMetric),
        strokeWidth: 3,
      },
    ],
  };

  const barData = {
    labels: ['E', 'S', 'G'],
    datasets: [
      {
        data: esgData
          ? [
              esgData.portfolioScore.environmental,
              esgData.portfolioScore.social,
              esgData.portfolioScore.governance,
            ]
          : [0, 0, 0],
      },
    ],
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            ESG Scoring
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Environmental, Social & Governance impact of your crypto portfolio
          </Text>
        </View>

        {esgData && (
          <>
            {/* Portfolio Overview */}
            <Card style={styles.overviewCard}>
              <Card.Content>
                <View style={styles.overviewHeader}>
                  <View style={styles.scoreContainer}>
                    <Text
                      variant="displaySmall"
                      style={[
                        styles.overallScore,
                        { color: getGradeColor(esgData.portfolioScore.grade) },
                      ]}
                    >
                      {esgData.portfolioScore.overall}
                    </Text>
                    <View
                      style={[
                        styles.gradeBadge,
                        { backgroundColor: getGradeColor(esgData.portfolioScore.grade) },
                      ]}
                    >
                      <Text variant="titleMedium" style={styles.gradeText}>
                        {esgData.portfolioScore.grade}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.overviewInfo}>
                    <Text variant="titleLarge" style={styles.overviewTitle}>
                      Portfolio ESG Score
                    </Text>
                    <Text variant="bodyMedium" style={styles.overviewDescription}>
                      Weighted by portfolio allocation
                    </Text>
                  </View>
                </View>

                {/* ESG Breakdown */}
                <View style={styles.breakdown}>
                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#4CAF50' }]} />
                    <Text variant="bodyMedium" style={styles.breakdownLabel}>
                      Environmental
                    </Text>
                    <Text variant="titleMedium" style={styles.breakdownValue}>
                      {esgData.portfolioScore.environmental}
                    </Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#2196F3' }]} />
                    <Text variant="bodyMedium" style={styles.breakdownLabel}>
                      Social
                    </Text>
                    <Text variant="titleMedium" style={styles.breakdownValue}>
                      {esgData.portfolioScore.social}
                    </Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#FF9800' }]} />
                    <Text variant="bodyMedium" style={styles.breakdownLabel}>
                      Governance
                    </Text>
                    <Text variant="titleMedium" style={styles.breakdownValue}>
                      {esgData.portfolioScore.governance}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Charts */}
            <Card style={styles.chartCard}>
              <Card.Content>
                <Text variant="titleLarge" style={styles.chartTitle}>
                  ESG Component Scores
                </Text>
                <BarChart
                  data={barData}
                  width={screenWidth - 80}
                  height={200}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                    style: { borderRadius: 16 },
                  }}
                  style={styles.chart}
                />
              </Card.Content>
            </Card>

            {/* Trend Chart */}
            {esgData.trends && esgData.trends.length > 0 && (
              <Card style={styles.chartCard}>
                <Card.Content>
                  <Text variant="titleLarge" style={styles.chartTitle}>
                    ESG Trends
                  </Text>

                  <SegmentedButtons
                    value={selectedMetric}
                    onValueChange={setSelectedMetric}
                    buttons={[
                      { value: 'overall', label: 'Overall' },
                      { value: 'environmental', label: 'Environmental' },
                      { value: 'social', label: 'Social' },
                      { value: 'governance', label: 'Governance' },
                    ]}
                    style={styles.segmentedButtons}
                  />

                  <LineChart
                    data={chartData}
                    width={screenWidth - 80}
                    height={200}
                    chartConfig={{
                      backgroundColor: '#ffffff',
                      backgroundGradientFrom: '#ffffff',
                      backgroundGradientTo: '#ffffff',
                      decimalPlaces: 0,
                      color: () => getMetricColor(selectedMetric),
                      style: { borderRadius: 16 },
                    }}
                    style={styles.chart}
                  />
                </Card.Content>
              </Card>
            )}

            {/* Asset Scores */}
            <View style={styles.assetsSection}>
              <Text variant="titleLarge" style={styles.assetsTitle}>
                Asset ESG Scores
              </Text>
              <Text variant="bodyMedium" style={styles.assetsSubtitle}>
                Individual crypto asset sustainability ratings
              </Text>

              {esgData.scores.map((asset) => (
                <Card key={asset.symbol} style={styles.assetCard}>
                  <Card.Content>
                    <View style={styles.assetHeader}>
                      <View style={styles.assetInfo}>
                        <View style={styles.assetIcon}>
                          <Ionicons name="logo-bitcoin" size={24} color="#FF9800" />
                        </View>
                        <View style={styles.assetDetails}>
                          <Text variant="titleMedium" style={styles.assetName}>
                            {asset.name}
                          </Text>
                          <Text variant="bodySmall" style={styles.assetSymbol}>
                            {asset.symbol} • {formatCurrency(asset.balanceUSD)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.assetScore}>
                        <Text
                          variant="titleLarge"
                          style={[styles.score, { color: getGradeColor(asset.grade) }]}
                        >
                          {asset.overall}
                        </Text>
                        <View
                          style={[
                            styles.gradeBadgeSmall,
                            { backgroundColor: getGradeColor(asset.grade) },
                          ]}
                        >
                          <Text variant="bodySmall" style={styles.gradeTextSmall}>
                            {asset.grade}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.assetMetrics}>
                      <View style={styles.metricChips}>
                        <Chip
                          mode="outlined"
                          textStyle={styles.chipText}
                          style={[styles.chip, { borderColor: '#4CAF50' }]}
                        >
                          E: {asset.environmental}
                        </Chip>
                        <Chip
                          mode="outlined"
                          textStyle={styles.chipText}
                          style={[styles.chip, { borderColor: '#2196F3' }]}
                        >
                          S: {asset.social}
                        </Chip>
                        <Chip
                          mode="outlined"
                          textStyle={styles.chipText}
                          style={[styles.chip, { borderColor: '#FF9800' }]}
                        >
                          G: {asset.governance}
                        </Chip>
                      </View>
                      {asset.energyIntensity && (
                        <Text variant="bodySmall" style={styles.energyText}>
                          Energy: {asset.energyIntensity.toLocaleString()} kWh/tx
                        </Text>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>

            {/* Methodology */}
            <Card style={styles.methodologyCard}>
              <Card.Content>
                <View style={styles.methodologyHeader}>
                  <Ionicons name="information-circle-outline" size={24} color="#2196F3" />
                  <Text variant="titleMedium" style={styles.methodologyTitle}>
                    ESG Methodology
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.methodologyText}>
                  ESG scores are calculated using the Dhanam Framework v2.0, considering energy
                  consumption, decentralization, community governance, and environmental
                  initiatives. Scores range from 0-100, with grades from F to A+.
                </Text>
              </Card.Content>
            </Card>

            <View style={styles.bottomPadding} />
          </>
        )}
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
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    fontWeight: '700',
    color: '#212121',
  },
  subtitle: {
    color: '#757575',
    marginTop: 4,
  },
  overviewCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 2,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreContainer: {
    alignItems: 'center',
    marginRight: 20,
  },
  overallScore: {
    fontWeight: '700',
    marginBottom: 8,
  },
  gradeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  gradeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  overviewInfo: {
    flex: 1,
  },
  overviewTitle: {
    color: '#212121',
    fontWeight: '600',
  },
  overviewDescription: {
    color: '#757575',
    marginTop: 4,
  },
  breakdown: {
    gap: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  breakdownLabel: {
    flex: 1,
    color: '#757575',
  },
  breakdownValue: {
    color: '#212121',
    fontWeight: '600',
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 2,
  },
  chartTitle: {
    color: '#212121',
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  assetsSection: {
    paddingHorizontal: 20,
  },
  assetsTitle: {
    color: '#212121',
    fontWeight: '600',
    marginBottom: 4,
  },
  assetsSubtitle: {
    color: '#757575',
    marginBottom: 16,
  },
  assetCard: {
    marginBottom: 12,
    elevation: 2,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  assetDetails: {
    flex: 1,
  },
  assetName: {
    color: '#212121',
    fontWeight: '600',
  },
  assetSymbol: {
    color: '#757575',
    marginTop: 2,
  },
  assetScore: {
    alignItems: 'center',
  },
  score: {
    fontWeight: '700',
    marginBottom: 4,
  },
  gradeBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  gradeTextSmall: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  assetMetrics: {
    gap: 8,
  },
  metricChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FAFAFA',
  },
  chipText: {
    fontSize: 12,
  },
  energyText: {
    color: '#757575',
    fontStyle: 'italic',
  },
  methodologyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    elevation: 1,
  },
  methodologyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  methodologyTitle: {
    color: '#2196F3',
    fontWeight: '600',
  },
  methodologyText: {
    color: '#757575',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 100,
  },
});
