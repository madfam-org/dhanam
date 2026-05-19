import React, { useState, useMemo } from 'react';
import { Alert } from 'react-native';

import {
  useReportSummary,
  useGeneratePdfReport,
  useGenerateCsvReport,
} from '@/hooks/api/useReports';
import { useSpaces } from '@/hooks/useSpaces';
import {
  Ionicons,
  View,
  ScrollView,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  Divider,
  TouchableRipple,
  ActivityIndicator,
  Chip,
} from '@/lib/react-native-compat';

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function displayDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type DateRangePreset =
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'thisYear';

interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

function getDateRange(preset: DateRangePreset): DateRange {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;
  let label: string;

  switch (preset) {
    case 'last7days':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      label = 'Last 7 Days';
      break;
    case 'last30days':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      label = 'Last 30 Days';
      break;
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      label = 'This Month';
      break;
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setDate(0); // Last day of previous month
      label = 'Last Month';
      break;
    case 'last3Months':
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 3);
      label = 'Last 3 Months';
      break;
    case 'thisYear':
      startDate = new Date(now.getFullYear(), 0, 1);
      label = 'This Year';
      break;
    default:
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
      label = 'Last 30 Days';
  }

  return { startDate, endDate, label };
}

const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'last7days', label: '7 Days' },
  { id: 'last30days', label: '30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'last3Months', label: '3 Months' },
  { id: 'thisYear', label: 'This Year' },
];

const reportTemplates = [
  {
    id: 'financial-summary',
    name: 'Financial Summary',
    description: 'Complete financial overview',
    icon: 'document-text-outline' as const,
    format: 'pdf' as const,
  },
  {
    id: 'transaction-export',
    name: 'Transaction Export',
    description: 'Export all transactions',
    icon: 'grid-outline' as const,
    format: 'csv' as const,
  },
  {
    id: 'budget-performance',
    name: 'Budget Performance',
    description: 'Budget tracking analysis',
    icon: 'wallet-outline' as const,
    format: 'pdf' as const,
  },
  {
    id: 'net-worth-trend',
    name: 'Net Worth Trend',
    description: 'Track net worth over time',
    icon: 'trending-up-outline' as const,
    format: 'pdf' as const,
  },
];

export default function ReportsScreen() {
  const { currentSpace } = useSpaces();
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last30days');

  const dateRange = useMemo(() => getDateRange(selectedPreset), [selectedPreset]);
  const startDateString = useMemo(() => formatDate(dateRange.startDate), [dateRange]);
  const endDateString = useMemo(() => formatDate(dateRange.endDate), [dateRange]);

  const { data: summary, isLoading: summaryLoading } = useReportSummary(
    startDateString,
    endDateString
  );

  const pdfMutation = useGeneratePdfReport();
  const csvMutation = useGenerateCsvReport();

  const isGenerating = pdfMutation.isPending || csvMutation.isPending;

  const handleExportPdf = async () => {
    try {
      await pdfMutation.mutateAsync({
        startDate: startDateString,
        endDate: endDateString,
      });
    } catch {
      Alert.alert('Error', 'Failed to generate PDF report');
    }
  };

  const handleExportCsv = async () => {
    try {
      await csvMutation.mutateAsync({
        startDate: startDateString,
        endDate: endDateString,
      });
    } catch {
      Alert.alert('Error', 'Failed to export transactions');
    }
  };

  if (!currentSpace) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="document-text-outline" size={48} color="#BDBDBD" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No space selected
        </Text>
        <Text variant="bodyMedium" style={styles.emptyDescription}>
          Please select a space to generate reports
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Date Range Selection */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Date Range
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsContainer}
            >
              {DATE_PRESETS.map((preset) => (
                <Chip
                  key={preset.id}
                  selected={selectedPreset === preset.id}
                  onPress={() => setSelectedPreset(preset.id)}
                  style={styles.presetChip}
                  mode={selectedPreset === preset.id ? 'flat' : 'outlined'}
                >
                  {preset.label}
                </Chip>
              ))}
            </ScrollView>
            <View style={styles.dateRangeDisplay}>
              <Ionicons name="calendar-outline" size={16} color="#4CAF50" />
              <Text variant="bodyMedium" style={styles.dateRangeText}>
                {displayDate(startDateString)} - {displayDate(endDateString)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Quick Export */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Quick Export
            </Text>
            <View style={styles.exportButtons}>
              <Button
                mode="contained"
                icon="document-text-outline"
                onPress={handleExportPdf}
                loading={pdfMutation.isPending}
                disabled={isGenerating}
                style={styles.exportButton}
                buttonColor="#4CAF50"
              >
                Export PDF
              </Button>
              <Button
                mode="outlined"
                icon="grid-outline"
                onPress={handleExportCsv}
                loading={csvMutation.isPending}
                disabled={isGenerating}
                style={styles.exportButton}
              >
                Export CSV
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Summary Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Period Summary
            </Text>
            {summaryLoading ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : summary ? (
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Ionicons name="arrow-down-circle-outline" size={24} color="#4CAF50" />
                  <Text variant="titleLarge" style={styles.summaryValue}>
                    {formatCurrency(summary.totalIncome, summary.currency)}
                  </Text>
                  <Text variant="bodySmall" style={styles.summaryLabel}>
                    Income
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons name="arrow-up-circle-outline" size={24} color="#F44336" />
                  <Text variant="titleLarge" style={[styles.summaryValue, styles.expenseValue]}>
                    {formatCurrency(summary.totalExpenses, summary.currency)}
                  </Text>
                  <Text variant="bodySmall" style={styles.summaryLabel}>
                    Expenses
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons
                    name={summary.netCashflow >= 0 ? 'trending-up' : 'trending-down'}
                    size={24}
                    color={summary.netCashflow >= 0 ? '#4CAF50' : '#F44336'}
                  />
                  <Text
                    variant="titleLarge"
                    style={[styles.summaryValue, summary.netCashflow < 0 && styles.expenseValue]}
                  >
                    {formatCurrency(summary.netCashflow, summary.currency)}
                  </Text>
                  <Text variant="bodySmall" style={styles.summaryLabel}>
                    Net Cash Flow
                  </Text>
                </View>
              </View>
            ) : (
              <Text variant="bodyMedium" style={styles.noData}>
                No data for selected period
              </Text>
            )}

            {summary && (
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text variant="bodyMedium" style={styles.statValue}>
                    {summary.transactionCount}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Transactions
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text variant="bodyMedium" style={styles.statValue}>
                    {summary.accountCount}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Accounts
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text variant="bodyMedium" style={styles.statValue}>
                    {summary.budgetCount}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Budgets
                  </Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Report Templates */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Report Templates
            </Text>
            {reportTemplates.map((template, index) => (
              <React.Fragment key={template.id}>
                <TouchableRipple
                  onPress={() => {
                    if (template.format === 'pdf') {
                      handleExportPdf();
                    } else {
                      handleExportCsv();
                    }
                  }}
                  style={styles.templateItem}
                  disabled={isGenerating}
                >
                  <View style={styles.templateContent}>
                    <View style={styles.templateIcon}>
                      <Ionicons name={template.icon} size={24} color="#4CAF50" />
                    </View>
                    <View style={styles.templateInfo}>
                      <Text variant="bodyLarge" style={styles.templateName}>
                        {template.name}
                      </Text>
                      <Text variant="bodySmall" style={styles.templateDescription}>
                        {template.description}
                      </Text>
                    </View>
                    <View style={styles.formatBadge}>
                      <Text style={styles.formatText}>{template.format.toUpperCase()}</Text>
                    </View>
                  </View>
                </TouchableRipple>
                {index < reportTemplates.length - 1 && <Divider style={styles.divider} />}
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>

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
  presetsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  presetChip: {
    marginRight: 4,
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  dateRangeText: {
    color: '#212121',
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
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
  summaryValue: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 8,
  },
  expenseValue: {
    color: '#F44336',
  },
  summaryLabel: {
    color: '#757575',
    marginTop: 4,
  },
  noData: {
    color: '#757575',
    textAlign: 'center',
    paddingVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '600',
    color: '#212121',
  },
  statLabel: {
    color: '#757575',
    marginTop: 2,
  },
  templateItem: {
    paddingVertical: 12,
  },
  templateContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  templateName: {
    fontWeight: '600',
    color: '#212121',
  },
  templateDescription: {
    color: '#757575',
    marginTop: 2,
  },
  formatBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  formatText: {
    color: '#1976D2',
    fontSize: 10,
    fontWeight: '600',
  },
  divider: {
    marginLeft: 52,
  },
  emptyState: {
    flex: 1,
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
