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

const categories = [
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills',
  'Healthcare',
  'Investment',
  'Other',
];

export default function AddTransactionScreen() {
  const { currentSpace } = useSpaces();
  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!description.trim() || !amount || !category) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/transactions', {
        spaceId: currentSpace?.id,
        type,
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        currency: currentSpace?.currency || 'USD',
        date: new Date().toISOString(),
      });
      router.back();
    } catch {
      setError('Failed to create transaction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Add Transaction
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Card.Content>
            {/* Type */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Type
              </Text>
              <SegmentedButtons
                value={type}
                onValueChange={setType}
                buttons={[
                  { value: 'expense', label: 'Expense' },
                  { value: 'income', label: 'Income' },
                  { value: 'transfer', label: 'Transfer' },
                ]}
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Description
              </Text>
              <TextInput
                mode="outlined"
                placeholder="What was this transaction for?"
                value={description}
                onChangeText={(text: string) => {
                  setDescription(text);
                  setError(null);
                }}
                style={styles.textInput}
                accessibilityLabel="Transaction description"
              />
            </View>

            {/* Amount */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Amount
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
                accessibilityLabel="Transaction amount"
              />
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Category
              </Text>
              <View style={styles.chipRow}>
                {categories.map((cat) => (
                  <Chip
                    key={cat}
                    selected={category === cat}
                    onPress={() => {
                      setCategory(cat);
                      setError(null);
                    }}
                    mode={category === cat ? 'flat' : 'outlined'}
                    style={[styles.chip, category === cat && styles.chipSelected]}
                    textStyle={category === cat ? styles.chipTextSelected : undefined}
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

      {/* Actions */}
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
          Save Transaction
        </Button>
      </View>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    fontWeight: '700',
    color: '#212121',
  },
  formCard: {
    marginHorizontal: 20,
    elevation: 2,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: '#212121',
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FAFAFA',
  },
  chipSelected: {
    backgroundColor: '#6366f1',
  },
  chipTextSelected: {
    color: 'white',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
});
