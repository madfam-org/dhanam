import { useState } from 'react';

import { useSpaces } from '@/hooks/useSpaces';
import {
  Ionicons,
  router,
  View,
  ScrollView,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  SegmentedButtons,
  Chip,
} from '@/lib/react-native-compat';
import { TextInput } from '@/lib/react-native-compat';
import { apiClient } from '@/services/api';

const budgetCategories = [
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills',
  'Healthcare',
  'Housing',
  'Education',
  'Savings',
  'Investment',
  'Other',
];

export default function CreateBudgetScreen() {
  const { currentSpace } = useSpaces();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (cat: string) => {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter a budget name');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (categories.length === 0) {
      setError('Please select at least one category');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/budgets', {
        spaceId: currentSpace?.id,
        name: name.trim(),
        amount: parseFloat(amount),
        period,
        categories,
        currency: currentSpace?.currency || 'USD',
      });
      router.back();
    } catch {
      setError('Failed to create budget. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Create Budget
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Card.Content>
            {/* Name */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Budget Name
              </Text>
              <TextInput
                mode="outlined"
                placeholder="e.g., Monthly Groceries, Entertainment"
                value={name}
                onChangeText={(text: string) => {
                  setName(text);
                  setError(null);
                }}
                style={styles.textInput}
                accessibilityLabel="Budget name"
              />
            </View>

            {/* Amount */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Budget Limit
              </Text>
              <TextInput
                mode="outlined"
                placeholder="0.00"
                value={amount}
                onChangeText={(text: string) => {
                  setAmount(text.replace(/[^0-9.]/g, ''));
                  setError(null);
                }}
                keyboardType="numeric"
                left={<TextInput.Icon icon="currency-usd" />}
                style={styles.textInput}
                accessibilityLabel="Budget limit amount"
              />
            </View>

            {/* Period */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Period
              </Text>
              <SegmentedButtons
                value={period}
                onValueChange={setPeriod}
                buttons={[
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'yearly', label: 'Yearly' },
                ]}
              />
            </View>

            {/* Categories */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Categories
              </Text>
              <Text variant="bodySmall" style={styles.hint}>
                Select the spending categories this budget tracks
              </Text>
              <View style={styles.chipRow}>
                {budgetCategories.map((cat) => (
                  <Chip
                    key={cat}
                    selected={categories.includes(cat)}
                    onPress={() => {
                      toggleCategory(cat);
                      setError(null);
                    }}
                    mode={categories.includes(cat) ? 'flat' : 'outlined'}
                    style={[styles.chip, categories.includes(cat) && styles.chipSelected]}
                    textStyle={categories.includes(cat) ? styles.chipTextSelected : undefined}
                  >
                    {cat}
                  </Chip>
                ))}
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#F44336" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => router.back()} style={styles.cancelButton}>
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={isLoading}
          disabled={isLoading}
          style={styles.submitButton}
        >
          Create Budget
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  title: { fontWeight: '700', color: '#212121' },
  formCard: { marginHorizontal: 20, elevation: 2 },
  field: { marginBottom: 20 },
  label: { color: '#212121', fontWeight: '600', marginBottom: 8 },
  hint: { color: '#757575', marginBottom: 8 },
  textInput: { backgroundColor: 'white' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#FAFAFA' },
  chipSelected: { backgroundColor: '#6366f1' },
  chipTextSelected: { color: 'white' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  errorText: { fontSize: 14, color: '#F44336' },
  actions: { flexDirection: 'row', padding: 20, gap: 12 },
  cancelButton: { flex: 1 },
  submitButton: { flex: 1 },
});
