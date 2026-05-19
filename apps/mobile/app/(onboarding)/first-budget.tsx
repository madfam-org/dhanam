import { useState, ComponentProps } from 'react';

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
import { TextInput } from '@/lib/react-native-compat';

import { useOnboarding } from '../../src/contexts/OnboardingContext';

interface Category {
  id: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  defaultAmount: number;
}

const categories: Category[] = [
  { id: 'food', label: 'Comida', icon: 'restaurant', color: '#f97316', defaultAmount: 5000 },
  { id: 'transport', label: 'Transporte', icon: 'car', color: '#3b82f6', defaultAmount: 2000 },
  { id: 'shopping', label: 'Compras', icon: 'bag', color: '#ec4899', defaultAmount: 3000 },
  {
    id: 'entertainment',
    label: 'Entretenimiento',
    icon: 'musical-notes',
    color: '#8b5cf6',
    defaultAmount: 2000,
  },
  { id: 'bills', label: 'Servicios', icon: 'receipt', color: '#6b7280', defaultAmount: 4000 },
  { id: 'healthcare', label: 'Salud', icon: 'medical', color: '#ef4444', defaultAmount: 1500 },
];

export default function FirstBudgetScreen() {
  const router = useRouter();
  const { updateStep, skipStep } = useOnboarding();
  const [budgetName, setBudgetName] = useState('Presupuesto mensual');
  const [totalAmount, setTotalAmount] = useState('20000');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'food',
    'transport',
    'bills',
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await updateStep('feature_tour', {
        budgetName,
        totalAmount: parseFloat(totalAmount) || 0,
        categories: selectedCategories,
      });
      router.push('/(onboarding)/feature-tour');
    } catch (error) {
      console.error('Error creating budget:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      await skipStep('first_budget');
      router.push('/(onboarding)/feature-tour');
    } catch {
      router.push('/(onboarding)/feature-tour');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="pie-chart-outline" size={36} color="white" />
          </View>
          <Text style={styles.headerTitle}>Tu primer presupuesto</Text>
          <Text style={styles.headerSubtitle}>
            Establece limites de gasto para controlar tus finanzas
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Budget Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nombre</Text>
            <TextInput
              mode="outlined"
              value={budgetName}
              onChangeText={(text: string) => setBudgetName(text)}
              style={styles.textInput}
              accessibilityLabel="Budget name"
            />
          </View>

          {/* Total Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Monto mensual total</Text>
            <TextInput
              mode="outlined"
              value={totalAmount}
              onChangeText={(text: string) => setTotalAmount(text.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              left={<TextInput.Icon icon="currency-usd" />}
              style={styles.textInput}
              accessibilityLabel="Monthly budget amount"
            />
          </View>

          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categorias</Text>
            <Text style={styles.sectionDescription}>
              Selecciona las categorias que quieres monitorear
            </Text>
            <View style={styles.categoriesGrid}>
              {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => toggleCategory(cat.id)}
                    style={[
                      styles.categoryCard,
                      isSelected && { borderColor: cat.color, backgroundColor: `${cat.color}10` },
                    ]}
                    accessible
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={cat.label}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: `${cat.color}20` }]}>
                      <Ionicons name={cat.icon} size={22} color={cat.color} />
                    </View>
                    <Text style={[styles.categoryLabel, isSelected && { color: cat.color }]}>
                      {cat.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={16} color={cat.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Summary */}
          {selectedCategories.length > 0 && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Resumen</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Presupuesto total</Text>
                <Text style={styles.summaryValue}>
                  ${parseFloat(totalAmount || '0').toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Categorias</Text>
                <Text style={styles.summaryValue}>{selectedCategories.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Periodo</Text>
                <Text style={styles.summaryValue}>Mensual</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Actions */}
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
              <Text style={styles.continueText}>Crear presupuesto</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Saltar por ahora</Text>
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
    lineHeight: 20,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: 'white',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  summaryBox: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
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
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
