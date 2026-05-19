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
} from '@/lib/react-native-compat';
import { TextInput } from '@/lib/react-native-compat';
import { apiClient } from '@/services/api';

const accountTypes = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit' },
  { value: 'investment', label: 'Investment' },
  { value: 'crypto', label: 'Crypto' },
];

export default function AddAccountScreen() {
  const { currentSpace } = useSpaces();
  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState(currentSpace?.currency || 'USD');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter an account name');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/accounts', {
        spaceId: currentSpace?.id,
        name: name.trim(),
        type,
        balance: parseFloat(balance) || 0,
        currency,
        provider: 'manual',
      });
      router.back();
    } catch {
      setError('Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Add Manual Account
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Add an account that you manage manually
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Card.Content>
            {/* Name */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Account Name
              </Text>
              <TextInput
                mode="outlined"
                placeholder="e.g., Chase Checking, Coinbase"
                value={name}
                onChangeText={(text: string) => {
                  setName(text);
                  setError(null);
                }}
                style={styles.textInput}
                accessibilityLabel="Account name"
              />
            </View>

            {/* Type */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Account Type
              </Text>
              <SegmentedButtons value={type} onValueChange={setType} buttons={accountTypes} />
            </View>

            {/* Balance */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Current Balance
              </Text>
              <TextInput
                mode="outlined"
                placeholder="0.00"
                value={balance}
                onChangeText={(text: string) => setBalance(text.replace(/[^0-9.-]/g, ''))}
                keyboardType="numeric"
                left={<TextInput.Icon icon="currency-usd" />}
                style={styles.textInput}
                accessibilityLabel="Account balance"
              />
            </View>

            {/* Currency */}
            <View style={styles.field}>
              <Text variant="titleMedium" style={styles.label}>
                Currency
              </Text>
              <SegmentedButtons
                value={currency}
                onValueChange={setCurrency}
                buttons={[
                  { value: 'USD', label: 'USD' },
                  { value: 'MXN', label: 'MXN' },
                  { value: 'EUR', label: 'EUR' },
                ]}
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#F44336" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color="#0ea5e9" />
          <Text style={styles.infoText}>
            To automatically sync bank accounts, use the Connect Account option on the Accounts tab.
          </Text>
        </View>
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
          Add Account
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
  subtitle: { color: '#757575', marginTop: 4 },
  formCard: { marginHorizontal: 20, elevation: 2 },
  field: { marginBottom: 20 },
  label: { color: '#212121', fontWeight: '600', marginBottom: 8 },
  textInput: { backgroundColor: 'white' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  errorText: { fontSize: 14, color: '#F44336' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 14,
    margin: 20,
    gap: 10,
  },
  infoText: { flex: 1, fontSize: 13, color: '#0c4a6e', lineHeight: 18 },
  actions: { flexDirection: 'row', padding: 20, gap: 12 },
  cancelButton: { flex: 1 },
  submitButton: { flex: 1 },
});
