import { useState, useRef } from 'react';

import {
  Ionicons,
  LinearGradient,
  useRouter,
  View,
  RNText as Text,
  TouchableOpacity,
  RNActivityIndicator as ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Alert,
} from '@/lib/react-native-compat';

import { useAuth } from '../../src/contexts/AuthContext';
import { useOnboarding } from '../../src/contexts/OnboardingContext';
import { apiClient } from '../../src/services/api';

export default function EmailVerificationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { updateStep, skipStep } = useOnboarding();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<any>>([]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) newCode[index + i] = digit;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = value.replace(/\D/g, '');
    setCode(newCode);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    if (verificationCode.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/auth/verify-email', { code: verificationCode });
      await updateStep('preferences');
      router.push('/(onboarding)/preferences');
    } catch (err: unknown) {
      setError('Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await apiClient.post('/auth/resend-verification');
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch {
      Alert.alert('Error', 'Could not resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSkip = async () => {
    try {
      await skipStep('email_verification');
      router.push('/(onboarding)/preferences');
    } catch {
      // Navigate anyway
      router.push('/(onboarding)/preferences');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-outline" size={36} color="white" />
        </View>
        <Text style={styles.headerTitle}>Verifica tu email</Text>
        <Text style={styles.headerSubtitle}>
          Enviamos un codigo de 6 digitos a{'\n'}
          {user?.email || 'tu correo'}
        </Text>
      </LinearGradient>

      {/* Code Input */}
      <View style={styles.content}>
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.codeInput,
                digit ? styles.codeInputFilled : null,
                error ? styles.codeInputError : null,
              ]}
              onPress={() => inputRefs.current[index]?.focus()}
              accessible
              accessibilityLabel={`Digit ${index + 1} of verification code`}
            >
              <Text style={[styles.codeText, digit ? styles.codeTextFilled : null]}>
                {digit || '-'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity onPress={handleResend} disabled={isResending} style={styles.resendButton}>
          {isResending ? (
            <ActivityIndicator size="small" color="#6366f1" />
          ) : (
            <Text style={styles.resendText}>Reenviar codigo</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleVerify}
          disabled={isLoading || code.join('').length !== 6}
          style={[
            styles.verifyButton,
            (isLoading || code.join('').length !== 6) && styles.buttonDisabled,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text style={styles.verifyButtonText}>Verificar</Text>
              <Ionicons name="checkmark" size={20} color="white" />
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
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInputFilled: {
    borderColor: '#6366f1',
    backgroundColor: '#f5f3ff',
  },
  codeInputError: {
    borderColor: '#ef4444',
  },
  codeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#d1d5db',
  },
  codeTextFilled: {
    color: '#1f2937',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
  resendButton: {
    paddingVertical: 12,
  },
  resendText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  actions: {
    padding: 20,
  },
  verifyButton: {
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
  verifyButtonText: {
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
