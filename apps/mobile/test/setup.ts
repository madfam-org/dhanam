// React Native module mocks for Jest environment

// Mock expo modules
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-token' }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  brand: 'Test',
  modelName: 'TestDevice',
}));

jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(undefined),
  isLoaded: jest.fn().mockReturnValue(true),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `dhanam://${path}`),
  openURL: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('mock-hash'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn((val: any) => ({ value: val })),
  useAnimatedStyle: jest.fn(() => ({})),
  withTiming: jest.fn((val: any) => val),
  withSpring: jest.fn((val: any) => val),
  runOnJS: jest.fn((fn: any) => fn),
  FadeIn: { duration: jest.fn().mockReturnThis() },
  FadeOut: { duration: jest.fn().mockReturnThis() },
  Layout: { duration: jest.fn().mockReturnThis() },
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  Swipeable: ({ children }: any) => children,
  GestureHandlerRootView: ({ children }: any) => children,
  Gesture: { Pan: jest.fn(), Tap: jest.fn() },
  GestureDetector: ({ children }: any) => children,
}));

// Mock react-native-paper components used via compat layer
jest.mock('react-native-paper', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    Provider: ({ children }: any) => children,
    Card: Object.assign(
      ({ children, onPress, style }: any) => {
        const Wrapper = onPress ? TouchableOpacity : View;
        return React.createElement(Wrapper, { onPress, style }, children);
      },
      { Content: ({ children }: any) => React.createElement(View, null, children) }
    ),
    Text: ({ children, variant, style }: any) => React.createElement(Text, { style }, children),
    ActivityIndicator: ({ size, style }: any) =>
      React.createElement(View, { testID: 'activity-indicator', style }),
    Button: ({ children, onPress, mode, style }: any) =>
      React.createElement(
        TouchableOpacity,
        { onPress, style, testID: 'paper-button' },
        React.createElement(Text, null, children)
      ),
    Chip: ({ children, style }: any) =>
      React.createElement(View, { style }, React.createElement(Text, null, children)),
    List: {
      Item: ({ title, description, onPress, left, right, style }: any) =>
        React.createElement(
          onPress ? TouchableOpacity : View,
          { onPress, style, testID: 'list-item' },
          left && left({}),
          React.createElement(
            View,
            null,
            React.createElement(Text, null, title),
            typeof description === 'string'
              ? React.createElement(Text, null, description)
              : description
          ),
          right && right({})
        ),
    },
  };
});

// Mock the compat layer
jest.mock('@/lib/react-native-compat', () => {
  const React = require('react');
  const RN = require('react-native');
  const Paper = require('react-native-paper');
  return {
    View: RN.View,
    Text: RN.Text,
    StyleSheet: RN.StyleSheet,
    SafeAreaView: RN.SafeAreaView || RN.View,
    Ionicons: ({ name, size, color }: any) =>
      React.createElement(RN.Text, { testID: `icon-${name}` }),
    Card: Paper.Card,
    PaperText: Paper.Text,
    PaperActivityIndicator: Paper.ActivityIndicator,
    Button: Paper.Button,
    List: Paper.List,
    Chip: Paper.Chip,
  };
});

// Mock tokens
jest.mock('@/tokens/colors', () => ({
  getAccountColor: () => '#6366f1',
  getTransactionColor: (type: string) => (type === 'income' ? '#22c55e' : '#ef4444'),
  surfaceColors: {
    light: {
      background: '#FAFAFA',
      surface: '#FFFFFF',
      textPrimary: '#1a1a1a',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
    },
  },
}));

// Mock currency formatting
jest.mock('@/utils/currency', () => ({
  formatCurrency: (amount: number, currency: string) => `$${amount.toFixed(2)}`,
  getCurrencySymbol: (currency: string) => '$',
  formatPercentage: (value: number) => `${value.toFixed(1)}%`,
  formatCompactNumber: (value: number) => String(value),
}));
