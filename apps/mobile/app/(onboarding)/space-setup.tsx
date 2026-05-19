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
import { TextInput } from '@/lib/react-native-compat';

import { useOnboarding } from '../../src/contexts/OnboardingContext';

const spaceTypes = [
  {
    type: 'personal',
    icon: 'person-outline' as const,
    title: 'Personal',
    description: 'Gestiona tus finanzas personales, cuentas y presupuestos',
    color: '#6366f1',
  },
  {
    type: 'business',
    icon: 'business-outline' as const,
    title: 'Negocio',
    description: 'Administra las finanzas de tu empresa o emprendimiento',
    color: '#10b981',
  },
];

export default function SpaceSetupScreen() {
  const router = useRouter();
  const { updateStep } = useOnboarding();
  const [spaceName, setSpaceName] = useState('');
  const [spaceType, setSpaceType] = useState('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!spaceName.trim()) {
      setError('Por favor ingresa un nombre para tu espacio');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await updateStep('connect_accounts', {
        spaceName: spaceName.trim(),
        spaceType,
      });
      router.push('/(onboarding)/connect-accounts');
    } catch (err) {
      console.error('Error creating space:', err);
      setError('Error al crear tu espacio. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="cube-outline" size={36} color="white" />
          </View>
          <Text style={styles.headerTitle}>Crea tu espacio</Text>
          <Text style={styles.headerSubtitle}>
            Un espacio organiza tus cuentas, transacciones y presupuestos
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Space Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nombre del espacio</Text>
            <TextInput
              mode="outlined"
              placeholder="Ej: Mis finanzas, Casa, Mi negocio"
              value={spaceName}
              onChangeText={(text: string) => {
                setSpaceName(text);
                setError(null);
              }}
              style={styles.textInput}
              error={!!error}
              accessibilityLabel="Space name"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          {/* Space Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de espacio</Text>
            <View style={styles.typeOptions}>
              {spaceTypes.map((st) => (
                <TouchableOpacity
                  key={st.type}
                  onPress={() => setSpaceType(st.type)}
                  style={[styles.typeCard, spaceType === st.type && { borderColor: st.color }]}
                  accessible
                  accessibilityRole="radio"
                  accessibilityState={{ selected: spaceType === st.type }}
                  accessibilityLabel={st.title}
                >
                  <View style={[styles.typeIcon, { backgroundColor: `${st.color}20` }]}>
                    <Ionicons name={st.icon} size={28} color={st.color} />
                  </View>
                  <Text style={styles.typeTitle}>{st.title}</Text>
                  <Text style={styles.typeDescription}>{st.description}</Text>
                  {spaceType === st.type && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color={st.color} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#0ea5e9" />
            <Text style={styles.infoText}>
              Podras crear mas espacios despues. Cada espacio tiene sus propias cuentas y
              presupuestos independientes.
            </Text>
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
              <Text style={styles.continueText}>Crear espacio</Text>
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
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: 'white',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 6,
  },
  typeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#f0f9ff',
    borderColor: '#0ea5e9',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#0c4a6e',
    lineHeight: 18,
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
