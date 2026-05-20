# Dhanam Ledger Mobile App

## Overview

The Dhanam Ledger mobile app is built with React Native and Expo, providing a comprehensive financial management experience on iOS and Android devices.

## Features

### 📱 Core Screens

#### Dashboard

- **Portfolio Overview** - Real-time net worth with interactive charts
- **Quick Actions** - Connect accounts, view recent transactions, budget alerts
- **Account Summary** - All connected accounts with balances and last sync status
- **ESG Score** - Portfolio-weighted sustainability score

#### Accounts Management

- **Connected Accounts** - List of all linked financial accounts
- **Provider Integration** - Support for Plaid (US), Belvo (MX), Bitso (crypto)
- **Account Details** - Balance history, sync status, provider information
- **Connection Flow** - Secure account linking with OAuth and API keys

#### Transactions

- **Transaction History** - Searchable list with smart filtering
- **Categorization** - Auto-categorization with manual override
- **Search & Filters** - By amount, date, category, account, merchant
- **Transaction Details** - Location data, tags, notes, receipts

#### Budget Management

- **Budget Overview** - Visual progress bars and spending insights
- **Category Tracking** - Spending by category with alerts
- **Budget Alerts** - Push notifications for threshold breaches
- **Historical Analysis** - Month-over-month budget performance

#### ESG Scoring

- **Portfolio ESG Score** - Weighted sustainability rating
- **Asset Breakdown** - Individual crypto asset ESG analysis
- **Trend Analysis** - ESG score changes over time
- **Impact Metrics** - Carbon footprint, energy usage, governance scores

### 🔐 Security Features

#### Biometric Authentication

- **TouchID/FaceID** - Native biometric authentication
- **Setup Flow** - Guided biometric enrollment
- **Fallback Options** - PIN/Password backup authentication
- **Security Settings** - Enable/disable biometric access

#### Multi-Factor Authentication

- **TOTP Support** - Time-based one-time passwords
- **QR Code Setup** - Easy authenticator app integration
- **Backup Codes** - Recovery codes for account access
- **Security Notifications** - Alerts for suspicious activities

#### Data Protection

- **Encrypted Storage** - Local data encrypted with Expo SecureStore
- **Secure Network** - TLS 1.3 for all API communications
- **Token Management** - Automatic token refresh and rotation
- **Logout Security** - Secure session termination

## Architecture

### Technology Stack

- **Framework**: React Native 0.74 with Expo SDK 51
- **Navigation**: Expo Router with file-based routing
- **State Management**: Zustand for app state, React Query for server state
- **UI Library**: React Native Paper (Material Design 3)
- **Charts**: react-native-chart-kit for data visualizations
- **Authentication**: JWT with biometric integration

### Project Structure

```
apps/mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab screens
│   └── accounts/          # Account management screens
├── src/
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API clients and utilities
│   ├── stores/            # Zustand stores
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Helper functions
├── assets/                # Static assets (fonts, images)
└── theme/                 # Design system configuration
```

### Key Components

#### Authentication Flow

```typescript
// Biometric authentication hook
const { isAvailable, isEnabled, authenticate, enableBiometric } = useBiometric();

// Check biometric authentication
const result = await authenticate('Access your account');
if (result.success) {
  // Proceed with login
}
```

#### API Integration

```typescript
// React Query for server state
const {
  data: accounts,
  isLoading,
  refetch,
} = useQuery({
  queryKey: ['accounts', currentSpace?.id],
  queryFn: () => apiClient.get(`/accounts?spaceId=${currentSpace!.id}`),
  enabled: !!currentSpace,
});
```

#### Provider Connections

```typescript
// Plaid connection flow
const handlePlaidConnect = async () => {
  const linkResponse = await apiClient.post('/providers/plaid/create-link', {
    spaceId: currentSpace.id,
    userId: user.id,
  });

  // Open Plaid Link (would use react-native-plaid-link-sdk)
  const { publicToken, metadata } = await PlaidLink.open({
    linkToken: linkResponse.data.linkToken,
  });

  // Exchange token
  await apiClient.post('/providers/plaid/exchange-token', {
    spaceId: currentSpace.id,
    publicToken,
    metadata,
  });
};
```

## Screen Documentation

### Dashboard Screen (`app/(tabs)/dashboard.tsx`)

Main overview screen with portfolio summary.

**Features:**

- Net worth calculation and trend chart
- Quick account balance overview
- Recent transactions list
- Budget alerts and notifications
- ESG score summary

**State Management:**

- Uses React Query for account and transaction data
- Real-time updates with automatic refetch
- Optimistic updates for better UX

### Accounts Screen (`app/(tabs)/accounts.tsx`)

Account management and connection interface.

**Features:**

- Connected account list with provider badges
- Account balance and last sync status
- Provider-specific connection flows
- Account settings and disconnection

**Provider Integration:**

- Plaid: OAuth-based connection for US banks
- Belvo: Credential-based connection for Mexican banks
- Bitso: API key-based connection for crypto exchange
- Manual: User-input account tracking

### Transactions Screen (`app/(tabs)/transactions.tsx`)

Comprehensive transaction management.

**Features:**

- Searchable transaction list
- Advanced filtering (date, amount, category, account)
- Automatic categorization with manual override
- Transaction details with location and tags
- Bulk operations for categorization

**Search & Filters:**

```typescript
const filteredTransactions = useMemo(() => {
  let filtered = transactions || [];

  // Apply search filter
  if (searchQuery) {
    filtered = filtered.filter(
      (tx) =>
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.merchantName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Apply type filter
  if (selectedFilter !== 'all') {
    filtered = filtered.filter((tx) => tx.type === selectedFilter);
  }

  return filtered;
}, [transactions, searchQuery, selectedFilter]);
```

### Budgets Screen (`app/(tabs)/budgets.tsx`)

Budget tracking and management interface.

**Features:**

- Budget overview with total spent/remaining
- Individual budget cards with progress bars
- Category allocation breakdown
- Budget alerts and notifications
- Historical budget performance

**Budget Visualization:**

```typescript
const progressPercentage = Math.min((budget.spent / budget.amount) * 100, 100);
const progressColor = getProgressColor(budget.spent, budget.amount);

<ProgressBar
  progress={progressPercentage / 100}
  color={progressColor}
  style={styles.progressBar}
/>
```

### ESG Screen (`app/(tabs)/esg.tsx`)

ESG scoring and sustainability analysis.

**Features:**

- Portfolio-weighted ESG score
- Individual crypto asset analysis
- ESG component breakdown (Environmental, Social, Governance)
- Trend analysis with interactive charts
- Impact metrics (carbon footprint, energy usage)

**ESG Data Structure:**

```typescript
interface ESGScore {
  symbol: string;
  name: string;
  environmental: number;
  social: number;
  governance: number;
  overall: number;
  grade: string;
  energyIntensity: number;
  balance: number;
  balanceUSD: number;
}
```

## Authentication Implementation

### Biometric Authentication (`src/hooks/useBiometric.ts`)

Comprehensive biometric authentication system.

**Features:**

- Hardware availability detection
- Biometric enrollment checking
- Multiple biometric types support (TouchID, FaceID, Fingerprint)
- Secure credential storage with AsyncStorage
- Fallback authentication options

**Implementation:**

```typescript
export function useBiometric(): BiometricHook {
  const [biometricState, setBiometricState] = useState({
    isAvailable: false,
    isEnrolled: false,
    supportedTypes: [],
    isEnabled: false,
  });

  const authenticate = async (reason?: string) => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });

    return { success: result.success, error: result.error };
  };
}
```

### Authentication Flow

1. **App Launch** - Check biometric availability and user preferences
2. **Login** - Traditional email/password with optional 2FA
3. **Biometric Setup** - Optional biometric enrollment after login
4. **Session Management** - JWT token handling with automatic refresh
5. **Logout** - Secure session termination and token cleanup

## Provider Integration

### Plaid Integration (`app/accounts/connect/plaid.tsx`)

US banking integration through Plaid Link.

**Connection Flow:**

1. Create Link token via API
2. Open Plaid Link interface
3. User selects institution and provides credentials
4. Receive public token from Plaid
5. Exchange public token for access token
6. Store encrypted access token
7. Sync account data

**Security Measures:**

- Read-only access permissions
- Encrypted token storage with AES-256-GCM
- Webhook signature verification
- Regular token health checks

### Bitso Integration (`app/accounts/connect/bitso.tsx`)

Cryptocurrency exchange integration with API credentials.

**Connection Flow:**

1. User provides Bitso API key and secret
2. Validate credentials with test API call
3. Store encrypted credentials
4. Sync cryptocurrency balances
5. Enable ESG scoring for crypto assets

**Security Features:**

- API credentials encrypted at rest
- Read-only permissions enforced
- Regular balance synchronization
- Connection health monitoring

## Development

### Setup Instructions

1. **Install Dependencies**

   ```bash
   cd apps/mobile
   pnpm install
   ```

2. **Configure Environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Server**
   ```bash
   pnpm dev        # Start Expo development server
   pnpm ios        # Run on iOS simulator
   pnpm android    # Run on Android emulator
   ```

### Build Process

#### Development Builds

```bash
pnpm build:dev          # Development build
pnpm build:preview      # Preview build for testing
```

#### Production Builds

```bash
pnpm build:ios          # iOS production build
pnpm build:android      # Android production build
pnpm build:all          # Build for all platforms
```

#### App Store Submission

```bash
pnpm submit:ios         # Submit to Apple App Store
pnpm submit:android     # Submit to Google Play Store
```

### Testing

#### Unit Testing

```bash
pnpm test               # Run unit tests
pnpm test:watch         # Run tests in watch mode
pnpm test:coverage      # Generate coverage report
```

#### E2E Testing

```bash
pnpm test:e2e           # Run end-to-end tests
pnpm test:e2e:ios       # E2E tests on iOS
pnpm test:e2e:android   # E2E tests on Android
```

### Performance Optimization

#### Bundle Size Optimization

- Tree shaking unused dependencies
- Lazy loading screens and components
- Optimizing asset sizes and formats
- Using Hermes JavaScript engine

#### Memory Management

- Proper cleanup of subscriptions and listeners
- Image caching and optimization
- Efficient list rendering with FlatList
- Background task management

#### Battery Optimization

- Reduced background processing
- Efficient data synchronization
- Smart push notification handling
- Location services optimization

## Deployment

### App Store Guidelines

#### iOS App Store

- Follow Apple's Human Interface Guidelines
- Implement proper biometric authentication flows
- Handle App Store review requirements
- Support latest iOS versions and devices

#### Google Play Store

- Follow Material Design guidelines
- Implement Android-specific features
- Handle Google Play review requirements
- Support multiple screen sizes and densities

### Release Process

1. **Version Bumping**

   ```bash
   pnpm version:patch      # Patch release (1.0.1)
   pnpm version:minor      # Minor release (1.1.0)
   pnpm version:major      # Major release (2.0.0)
   ```

2. **Build Generation**

   ```bash
   pnpm build:production   # Generate production builds
   pnpm test:final        # Run comprehensive tests
   ```

3. **Store Submission**
   ```bash
   pnpm submit:stores     # Submit to both app stores
   ```

### Environment Configuration

#### Development

```env
API_BASE_URL=http://localhost:4010/v1
EXPO_PUBLIC_API_URL=http://localhost:4010/v1
EXPO_PUBLIC_POSTHOG_KEY=phc-dev-key
```

#### Production

```env
API_BASE_URL=https://api.dhan.am/v1
EXPO_PUBLIC_API_URL=https://api.dhan.am/v1
EXPO_PUBLIC_POSTHOG_KEY=phc-prod-key
```

## Troubleshooting

### Common Issues

#### Build Failures

- **Metro bundler issues**: Clear cache with `pnpm start --clear`
- **Native dependencies**: Run `cd ios && pod install` for iOS
- **Android build errors**: Clean with `cd android && ./gradlew clean`

#### Authentication Issues

- **Biometric not working**: Check device enrollment and app permissions
- **Token refresh failures**: Verify API connectivity and token storage
- **Login loops**: Clear AsyncStorage and restart app

#### Provider Connection Issues

- **Plaid Link errors**: Verify Link token generation and expiration
- **Bitso API failures**: Check API credentials and network connectivity
- **Sync timeouts**: Increase timeout values in API client configuration

### Debug Tools

#### React Native Debugger

```bash
# Install React Native Debugger
brew install --cask react-native-debugger

# Start debugger
react-native-debugger
```

#### Flipper Integration

```bash
# Install Flipper
brew install --cask flipper

# Connect to development build
# Flipper will automatically detect the app
```

#### Expo DevTools

```bash
# Open Expo DevTools
pnpm start

# Press 'd' to open developer menu
# Press 'j' to open Chrome DevTools
```

## Support and Resources

### Documentation

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Native Paper](https://reactnativepaper.com/)

### Community

- [Discord Community](https://discord.gg/dhanam)
- [GitHub Discussions](https://github.com/aldoruizluna/dhanam/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/dhanam)

### Support

- **Technical Support**: [mobile@dhan.am](mailto:mobile@dhan.am)
- **Bug Reports**: [GitHub Issues](https://github.com/aldoruizluna/dhanam/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/aldoruizluna/dhanam/discussions)

---

**Last Updated**: 2026-05-20
**App Version**: v1.0.0
**Minimum OS**: iOS 12.0, Android 6.0 (API level 23)
