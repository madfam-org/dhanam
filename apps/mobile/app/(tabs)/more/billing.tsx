import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, Alert, Linking, NativeModules, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';

import { useAuth } from '@/hooks/useAuth';
import { billingApi, SubscriptionStatus } from '@/services/api';
import {
  Ionicons,
  View,
  StyleSheet,
  PaperText as Text,
  Card,
  Button,
  Divider,
  ActivityIndicator,
} from '@/lib/react-native-compat';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  recommended?: boolean;
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      'Unlimited account connections',
      'Transaction tracking',
      'Basic budgeting',
      '60-day cashflow forecast',
      'Net worth tracking',
    ],
  },
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    price: '$9.99',
    period: '/month',
    recommended: true,
    features: [
      'Everything in Free',
      'Monte Carlo retirement simulations',
      'Goal probability tracking',
      'Scenario stress testing',
      'Long-term projections (30 years)',
      'Advanced analytics',
      'Priority support',
      'Custom reports',
    ],
  },
  {
    id: 'premium_annual',
    name: 'Premium Annual',
    price: '$79.99',
    period: '/year',
    features: [
      'Everything in Premium Monthly',
      '2 months free (save $40)',
      'Early access to new features',
    ],
  },
];

// Get user's country code for payment provider routing (MX → Stripe México, others → Paddle)
function getCountryCode(): string {
  try {
    // Try to get country from device locale
    if (Platform.OS === 'ios') {
      const locale =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        '';
      // Locale format can be "en_MX" or "es-MX" - extract the country code
      const parts = locale.split(/[-_]/);
      if (parts.length >= 2) {
        return parts[1].toUpperCase();
      }
    } else if (Platform.OS === 'android') {
      const locale = NativeModules.I18nManager?.localeIdentifier || '';
      const parts = locale.split(/[-_]/);
      if (parts.length >= 2) {
        return parts[1].toUpperCase();
      }
    }
    // Fallback to Intl API
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    // Common Mexico time zones
    if (timeZone.includes('Mexico') || timeZone.includes('Cancun') || timeZone.includes('Merida')) {
      return 'MX';
    }
    return 'US';
  } catch {
    return 'US';
  }
}

export default function BillingScreen() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Determine premium status from subscription status or user object
  const isPremium = subscriptionStatus?.tier === 'pro' || user?.subscriptionTier === 'pro';

  // Fetch subscription status on mount
  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const status = await billingApi.getStatus();
      setSubscriptionStatus(status);
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
      // Fall back to user object if API fails
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  // Handle deep link callback after checkout
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (url.includes('billing-success') || url.includes('checkout-complete')) {
        // Refresh subscription status after successful checkout
        await fetchSubscriptionStatus();
        if (refreshUser) {
          await refreshUser();
        }
        Alert.alert(
          'Subscription Activated',
          'Thank you! Your premium subscription is now active.',
          [{ text: 'OK' }]
        );
      }
    };

    const subscription = ExpoLinking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [fetchSubscriptionStatus, refreshUser]);

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') {
      Alert.alert('Free Plan', 'You are already on the free plan.');
      return;
    }

    setLoading(true);
    setSelectedPlan(planId);

    try {
      const countryCode = getCountryCode();
      const plan = planId === 'premium_annual' ? 'annual' : 'monthly';

      // Generate callback URLs for the checkout flow
      const successUrl = ExpoLinking.createURL('billing-success');
      const cancelUrl = ExpoLinking.createURL('billing-cancel');

      const response = await billingApi.upgradeToPremium({
        plan,
        successUrl,
        cancelUrl,
        countryCode,
      });

      // Open checkout URL in browser
      const result = await WebBrowser.openAuthSessionAsync(response.checkoutUrl, successUrl);

      if (result.type === 'success') {
        // Refresh subscription status after returning from checkout
        await fetchSubscriptionStatus();
        if (refreshUser) {
          await refreshUser();
        }
      }
    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert(
        'Subscription Error',
        'There was a problem starting the checkout process. Please try again or contact support.',
        [
          { text: 'OK' },
          {
            text: 'Contact Support',
            onPress: () => Linking.openURL('mailto:support@dhan.am'),
          },
        ]
      );
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const handleRestorePurchases = async () => {
    setLoading(true);
    try {
      // Refresh subscription status from the server
      await fetchSubscriptionStatus();
      if (refreshUser) {
        await refreshUser();
      }

      if (subscriptionStatus?.tier === 'pro') {
        Alert.alert(
          'Subscription Restored',
          'Your premium subscription has been restored successfully!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Subscription Found',
          'No active subscription was found for your account. If you believe this is an error, please contact support.',
          [
            { text: 'OK' },
            {
              text: 'Contact Support',
              onPress: () => Linking.openURL('mailto:support@dhan.am'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Restore purchases error:', error);
      Alert.alert('Error', 'Failed to check subscription status. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const response = await billingApi.createPortalSession();

      // Open the billing portal in browser
      await WebBrowser.openBrowserAsync(response.portalUrl);

      // Refresh status after returning from portal
      await fetchSubscriptionStatus();
      if (refreshUser) {
        await refreshUser();
      }
    } catch (error) {
      console.error('Portal error:', error);
      // Fall back to showing options if portal creation fails
      Alert.alert(
        'Manage Subscription',
        'Unable to open billing portal. Please try an alternative method.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Web Dashboard',
            onPress: () => Linking.openURL('https://app.dhan.am/settings/billing'),
          },
          {
            text: 'Contact Support',
            onPress: () => Linking.openURL('mailto:support@dhan.am'),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  if (statusLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading subscription status...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Current Status */}
        <Card style={styles.statusCard}>
          <Card.Content>
            <View style={styles.statusHeader}>
              <View
                style={[styles.statusBadge, isPremium ? styles.premiumBadge : styles.freeBadge]}
              >
                <Ionicons
                  name={isPremium ? 'star' : 'star-outline'}
                  size={20}
                  color={isPremium ? '#FFD700' : '#757575'}
                />
                <Text
                  variant="labelLarge"
                  style={[styles.statusText, isPremium ? styles.premiumText : styles.freeText]}
                >
                  {isPremium ? 'Premium' : 'Free Plan'}
                </Text>
              </View>
            </View>
            <Text variant="bodyMedium" style={styles.statusDescription}>
              {isPremium
                ? 'You have access to all premium features including Monte Carlo simulations, scenario analysis, and advanced projections.'
                : 'Upgrade to Premium to unlock advanced financial planning tools.'}
            </Text>
            {isPremium && subscriptionStatus?.expiresAt && (
              <Text variant="bodySmall" style={styles.expirationText}>
                Renews on {new Date(subscriptionStatus.expiresAt).toLocaleDateString()}
              </Text>
            )}
            {isPremium && (
              <Button
                mode="outlined"
                onPress={handleManageSubscription}
                loading={loading && !selectedPlan}
                disabled={loading}
                style={styles.manageButton}
              >
                Manage Subscription
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Plans */}
        {SUBSCRIPTION_PLANS.map((plan) => (
          <Card
            key={plan.id}
            style={[
              styles.planCard,
              plan.recommended && styles.recommendedCard,
              isPremium && plan.id !== 'free' && styles.currentPlanCard,
            ]}
          >
            {plan.recommended && !isPremium && (
              <View style={styles.recommendedBanner}>
                <Text variant="labelSmall" style={styles.recommendedText}>
                  RECOMMENDED
                </Text>
              </View>
            )}
            <Card.Content>
              <View style={styles.planHeader}>
                <View>
                  <Text variant="titleLarge" style={styles.planName}>
                    {plan.name}
                  </Text>
                  <View style={styles.priceContainer}>
                    <Text variant="headlineMedium" style={styles.planPrice}>
                      {plan.price}
                    </Text>
                    <Text variant="bodySmall" style={styles.planPeriod}>
                      {plan.period}
                    </Text>
                  </View>
                </View>
                {isPremium && plan.id !== 'free' && (
                  <View style={styles.currentBadge}>
                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                  </View>
                )}
              </View>

              <Divider style={styles.planDivider} />

              <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Ionicons name="checkmark" size={18} color="#4CAF50" />
                    <Text variant="bodyMedium" style={styles.featureText}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              {plan.id !== 'free' && !isPremium && (
                <Button
                  mode="contained"
                  onPress={() => handleSubscribe(plan.id)}
                  loading={loading && selectedPlan === plan.id}
                  disabled={loading}
                  buttonColor={plan.recommended ? '#4CAF50' : '#2196F3'}
                  style={styles.subscribeButton}
                >
                  {loading && selectedPlan === plan.id
                    ? 'Processing...'
                    : `Subscribe to ${plan.name}`}
                </Button>
              )}

              {plan.id === 'free' && !isPremium && (
                <View style={styles.currentPlanIndicator}>
                  <Text variant="bodyMedium" style={styles.currentPlanText}>
                    Current Plan
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        ))}

        {/* Feature Comparison */}
        <Card style={styles.comparisonCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.comparisonTitle}>
              Feature Comparison
            </Text>
            <View style={styles.comparisonTable}>
              <View style={styles.comparisonHeader}>
                <Text variant="labelMedium" style={styles.comparisonFeatureHeader}>
                  Feature
                </Text>
                <Text variant="labelMedium" style={styles.comparisonPlanHeader}>
                  Free
                </Text>
                <Text variant="labelMedium" style={styles.comparisonPlanHeader}>
                  Premium
                </Text>
              </View>
              <Divider />
              {[
                { feature: 'Account Connections', free: 'Unlimited', premium: 'Unlimited' },
                { feature: 'Transaction History', free: '90 days', premium: 'Unlimited' },
                { feature: 'Budgeting', free: true, premium: true },
                { feature: 'Cashflow Forecast', free: '60 days', premium: '1 year' },
                { feature: 'Retirement Planning', free: false, premium: true },
                { feature: 'Monte Carlo Simulations', free: false, premium: true },
                { feature: 'Goal Probability', free: false, premium: true },
                { feature: 'Scenario Analysis', free: false, premium: true },
                { feature: 'Long-term Projections', free: false, premium: true },
                { feature: 'Priority Support', free: false, premium: true },
              ].map((row, index) => (
                <View key={index}>
                  <View style={styles.comparisonRow}>
                    <Text variant="bodySmall" style={styles.comparisonFeature}>
                      {row.feature}
                    </Text>
                    <View style={styles.comparisonValue}>
                      {typeof row.free === 'boolean' ? (
                        <Ionicons
                          name={row.free ? 'checkmark' : 'close'}
                          size={18}
                          color={row.free ? '#4CAF50' : '#BDBDBD'}
                        />
                      ) : (
                        <Text variant="bodySmall" style={styles.comparisonValueText}>
                          {row.free}
                        </Text>
                      )}
                    </View>
                    <View style={styles.comparisonValue}>
                      {typeof row.premium === 'boolean' ? (
                        <Ionicons
                          name={row.premium ? 'checkmark' : 'close'}
                          size={18}
                          color={row.premium ? '#4CAF50' : '#BDBDBD'}
                        />
                      ) : (
                        <Text variant="bodySmall" style={styles.comparisonValueText}>
                          {row.premium}
                        </Text>
                      )}
                    </View>
                  </View>
                  {index < 9 && <Divider style={styles.rowDivider} />}
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Restore Purchases */}
        <Card style={styles.restoreCard}>
          <Card.Content style={styles.restoreContent}>
            <Text variant="bodyMedium" style={styles.restoreText}>
              Already subscribed through another device?
            </Text>
            <Button
              mode="text"
              onPress={handleRestorePurchases}
              loading={loading && !selectedPlan}
              disabled={loading}
            >
              Restore Purchases
            </Button>
          </Card.Content>
        </Card>

        {/* Support */}
        <View style={styles.supportContainer}>
          <Text variant="bodySmall" style={styles.supportText}>
            Questions about billing?{' '}
            <Text
              style={styles.supportLink}
              onPress={() => Linking.openURL('mailto:support@dhan.am')}
            >
              Contact Support
            </Text>
          </Text>
        </View>

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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#757575',
  },
  scrollView: {
    flex: 1,
  },
  statusCard: {
    margin: 16,
    elevation: 2,
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  premiumBadge: {
    backgroundColor: '#FFF8E1',
  },
  freeBadge: {
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontWeight: '600',
  },
  premiumText: {
    color: '#F57C00',
  },
  freeText: {
    color: '#757575',
  },
  statusDescription: {
    textAlign: 'center',
    color: '#616161',
    lineHeight: 22,
  },
  expirationText: {
    textAlign: 'center',
    color: '#9E9E9E',
    marginTop: 8,
  },
  manageButton: {
    marginTop: 16,
  },
  planCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 1,
  },
  recommendedCard: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  currentPlanCard: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  recommendedBanner: {
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    alignItems: 'center',
  },
  recommendedText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planName: {
    fontWeight: '600',
    color: '#212121',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  planPrice: {
    fontWeight: '700',
    color: '#212121',
  },
  planPeriod: {
    color: '#757575',
    marginLeft: 4,
  },
  currentBadge: {
    marginTop: 4,
  },
  planDivider: {
    marginVertical: 16,
  },
  featuresContainer: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: '#424242',
    flex: 1,
  },
  subscribeButton: {
    marginTop: 16,
  },
  currentPlanIndicator: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  currentPlanText: {
    color: '#757575',
    fontWeight: '500',
  },
  comparisonCard: {
    margin: 16,
    marginTop: 8,
    elevation: 1,
  },
  comparisonTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  comparisonTable: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  comparisonFeatureHeader: {
    flex: 2,
    color: '#757575',
    fontWeight: '600',
  },
  comparisonPlanHeader: {
    flex: 1,
    textAlign: 'center',
    color: '#757575',
    fontWeight: '600',
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  comparisonFeature: {
    flex: 2,
    color: '#424242',
  },
  comparisonValue: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonValueText: {
    color: '#424242',
    textAlign: 'center',
  },
  rowDivider: {
    height: 1,
  },
  restoreCard: {
    marginHorizontal: 16,
    marginTop: 8,
    elevation: 1,
  },
  restoreContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreText: {
    color: '#757575',
    marginBottom: 4,
  },
  supportContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  supportText: {
    color: '#757575',
  },
  supportLink: {
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
  bottomPadding: {
    height: 40,
  },
});
