import { useState, useRef, ComponentProps } from 'react';

import {
  Ionicons,
  LinearGradient,
  useRouter,
  View,
  RNText as Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StyleSheet,
} from '@/lib/react-native-compat';

import { useOnboarding } from '../../src/contexts/OnboardingContext';

const { width } = Dimensions.get('window');

interface Feature {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  gradient: [string, string];
}

const features: Feature[] = [
  {
    icon: 'analytics-outline',
    title: 'Dashboard inteligente',
    description:
      'Ve tu patrimonio neto, tendencias de gasto y cuentas en un solo lugar. Todo actualizado automaticamente.',
    gradient: ['#6366f1', '#8b5cf6'],
  },
  {
    icon: 'card-outline',
    title: 'Cuentas conectadas',
    description:
      'Conecta bancos, exchanges crypto y wallets. Sincronizacion automatica y segura con encriptacion de extremo a extremo.',
    gradient: ['#10b981', '#059669'],
  },
  {
    icon: 'pie-chart-outline',
    title: 'Presupuestos inteligentes',
    description:
      'Crea presupuestos por categoria con alertas automaticas. La IA categoriza tus transacciones por ti.',
    gradient: ['#f97316', '#ea580c'],
  },
  {
    icon: 'leaf-outline',
    title: 'Analisis ESG',
    description:
      'Evalua el impacto ambiental, social y de gobernanza de tus inversiones crypto con nuestro framework exclusivo.',
    gradient: ['#059669', '#047857'],
  },
  {
    icon: 'trending-up-outline',
    title: 'Proyecciones y simulaciones',
    description:
      'Usa simulaciones Monte Carlo para proyectar tu futuro financiero. Planea tu retiro con confianza.',
    gradient: ['#3b82f6', '#2563eb'],
  },
];

export default function FeatureTourScreen() {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<typeof ScrollView>(null);

  const handleNext = () => {
    if (currentIndex < features.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      (scrollRef.current as any)?.scrollTo({ x: nextIndex * width, animated: true });
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    try {
      await completeOnboarding();
      router.push('/(onboarding)/completion');
    } catch {
      router.push('/(onboarding)/completion');
    }
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleFinish} style={styles.skipTopButton}>
          <Text style={styles.skipTopText}>Saltar tour</Text>
        </TouchableOpacity>
      </View>

      {/* Feature Carousel */}
      <ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.carousel}
      >
        {features.map((feature, index) => (
          <View key={index} style={[styles.slide, { width }]}>
            <LinearGradient colors={feature.gradient} style={styles.slideGradient}>
              <View style={styles.slideIconCircle}>
                <Ionicons name={feature.icon} size={56} color="white" />
              </View>
            </LinearGradient>

            <View style={styles.slideContent}>
              <Text style={styles.slideTitle}>{feature.title}</Text>
              <Text style={styles.slideDescription}>{feature.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {features.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, currentIndex === index ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
          <Text style={styles.nextText}>
            {currentIndex === features.length - 1 ? 'Comenzar' : 'Siguiente'}
          </Text>
          <Ionicons
            name={currentIndex === features.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={20}
            color="white"
          />
        </TouchableOpacity>

        <Text style={styles.progressText}>
          {currentIndex + 1} de {features.length}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  skipTopButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipTopText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  carousel: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
  },
  slideGradient: {
    width: width - 40,
    height: 240,
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideIconCircle: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideContent: {
    paddingHorizontal: 32,
    paddingTop: 32,
    alignItems: 'center',
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#6366f1',
    width: 24,
  },
  dotInactive: {
    backgroundColor: '#d1d5db',
  },
  actions: {
    padding: 20,
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  nextText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  progressText: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 12,
  },
});
