import { useState } from 'react';

import {
  Ionicons,
  LinearGradient,
  useRouter,
  View,
  RNText as Text,
  ScrollView,
  TouchableOpacity,
  RNActivityIndicator as ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from '@/lib/react-native-compat';

import { useOnboarding } from '../../src/contexts/OnboardingContext';

const languages = [
  { code: 'es', label: 'Espanol', flag: '🇲🇽' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

const currencies = [
  { code: 'MXN', label: 'Peso Mexicano', symbol: '$' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: 'E' },
];

const regions = [
  { code: 'MX', label: 'Mexico', flag: '🇲🇽' },
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'OTHER', label: 'Other', flag: '🌎' },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const { updateStep } = useOnboarding();
  const [language, setLanguage] = useState('es');
  const [currency, setCurrency] = useState('MXN');
  const [region, setRegion] = useState('MX');
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await updateStep('space_setup', { language, currency, region });
      router.push('/(onboarding)/space-setup');
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderOption = (
    items: Array<{ code: string; label: string; flag?: string; symbol?: string }>,
    selected: string,
    onSelect: (code: string) => void
  ) => (
    <View style={styles.optionsRow}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.code}
          onPress={() => onSelect(item.code)}
          style={[styles.optionCard, selected === item.code && styles.optionCardSelected]}
          accessible
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === item.code }}
          accessibilityLabel={item.label}
        >
          {item.flag && <Text style={styles.optionFlag}>{item.flag}</Text>}
          {item.symbol && <Text style={styles.optionSymbol}>{item.symbol}</Text>}
          <Text style={[styles.optionLabel, selected === item.code && styles.optionLabelSelected]}>
            {item.label}
          </Text>
          {selected === item.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="settings-outline" size={36} color="white" />
          </View>
          <Text style={styles.headerTitle}>Tus preferencias</Text>
          <Text style={styles.headerSubtitle}>Personaliza tu experiencia en Dhanam</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Language */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Idioma</Text>
            <Text style={styles.sectionDescription}>Selecciona el idioma de la aplicacion</Text>
            {renderOption(languages, language, setLanguage)}
          </View>

          {/* Currency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Moneda principal</Text>
            <Text style={styles.sectionDescription}>La moneda por defecto para tus cuentas</Text>
            {renderOption(currencies, currency, setCurrency)}
          </View>

          {/* Region */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Region</Text>
            <Text style={styles.sectionDescription}>
              Esto nos ayuda a conectar con los proveedores correctos
            </Text>
            {renderOption(regions, region, setRegion)}
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={isLoading}
          style={[styles.continueButton, isLoading && styles.buttonDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text style={styles.continueText}>Continuar</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  optionsRow: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  optionCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#f5f3ff',
  },
  optionFlag: {
    fontSize: 24,
  },
  optionSymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6b7280',
    width: 28,
    textAlign: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  optionLabelSelected: {
    color: '#6366f1',
    fontWeight: '600',
  },
  actions: {
    padding: 20,
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  continueText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
