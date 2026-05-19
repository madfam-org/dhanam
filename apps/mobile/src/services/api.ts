import axios from 'axios';
import { Platform } from 'react-native';

// API Configuration
const API_BASE_URL = __DEV__
  ? Platform.OS === 'ios'
    ? 'http://localhost:4010/v1'
    : 'http://10.0.2.2:4010/v1'
  : 'https://api.dhan.am/v1';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    if (__DEV__) {
      console.log(`🔵 ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    if (__DEV__) {
      console.log('🔴 Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(
        `🟢 ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`
      );
    }
    return response;
  },
  async (error) => {
    if (__DEV__) {
      console.log('🔴 Response Error:', error.response?.status, error.response?.data);
    }

    // AuthContext owns refresh/logout so the interceptor only normalizes errors.
    if (error.response?.status === 401) {
      delete apiClient.defaults.headers.common['Authorization'];
    }

    // Transform error for better error handling
    const errorMessage =
      error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(errorMessage));
  }
);

// Onboarding API
export const onboardingApi = {
  getStatus: async () => {
    const response = await apiClient.get('/onboarding/status');
    return response.data;
  },
  updateStep: async (step: string, data?: Record<string, unknown>) => {
    const response = await apiClient.post('/onboarding/step', { step, data });
    return response.data;
  },
  complete: async (skipOptional = false) => {
    const response = await apiClient.post('/onboarding/complete', { skipOptional });
    return response.data;
  },
  skipStep: async (step: string) => {
    const response = await apiClient.post('/onboarding/skip', { step });
    return response.data;
  },
};

// Billing Types
export interface SubscriptionStatus {
  tier: 'community' | 'essentials' | 'pro';
  startedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

export interface UpgradeResponse {
  checkoutUrl: string;
  provider: 'stripe' | 'paddle';
}

export interface PortalResponse {
  portalUrl: string;
}

// Billing API
export const billingApi = {
  /**
   * Get subscription status for the authenticated user
   */
  getStatus: async (): Promise<SubscriptionStatus> => {
    const response = await apiClient.get<SubscriptionStatus>('/billing/status');
    return response.data;
  },

  /**
   * Initiate upgrade to premium subscription
   * Backend routes MX → Stripe México, others → Paddle
   */
  upgradeToPremium: async (options: {
    plan?: 'monthly' | 'annual';
    successUrl?: string;
    cancelUrl?: string;
    countryCode?: string;
  }): Promise<UpgradeResponse> => {
    const response = await apiClient.post<UpgradeResponse>('/billing/upgrade', options);
    return response.data;
  },

  /**
   * Create billing portal session for subscription management
   */
  createPortalSession: async (): Promise<PortalResponse> => {
    const response = await apiClient.post<PortalResponse>('/billing/portal');
    return response.data;
  },
};

export default apiClient;
