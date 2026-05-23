# ADR-004: Janua Authentication Integration

## Status

**Accepted** - January 2025

> **Billing note (ADR-008, May 2026):** Janua is mandatory for **identity** only.
> Optional Janua-mediated checkout (`JANUA_BILLING_ENABLED`) is a separate
> money-movement adapter behind Dhanam's `PaymentGatewayRegistry`; financial
> data providers never route through Janua.

## Context

Dhanam is part of the MADFAM ecosystem of products (Dhanam, Enclii, Copernic, etc.). Authentication requirements:

1. **Single Sign-On**: Users should authenticate once across MADFAM products
2. **Security**: Financial data requires robust authentication (2FA, session management)
3. **Multi-Tenancy**: Support for personal and business spaces
4. **Compliance**: SOC 2 Type II for financial services
5. **Developer Experience**: Standard OAuth 2.0 / OIDC flows

Options considered:

1. **Custom Auth**: Build authentication from scratch
2. **Auth0**: Industry standard, expensive at scale
3. **Clerk**: Modern DX, limited enterprise features
4. **Janua**: MADFAM's own SSO platform, full control

## Decision

Use **Janua** (MADFAM's internal SSO platform) for all authentication and authorization.

### Why Janua

1. **MADFAM Ecosystem Integration**
   - Single identity across Dhanam, Enclii, Copernic
   - Shared user profiles and preferences
   - Cross-product analytics and insights

2. **Cost Control**
   - No per-MAU pricing from external providers
   - Infrastructure costs shared across MADFAM products
   - Full control over feature development

3. **Compliance Ownership**
   - Direct SOC 2 audit control
   - Data residency control for LATAM users
   - Custom compliance features for Mexican regulations

4. **Feature Alignment**
   - TOTP 2FA built specifically for financial apps
   - Biometric authentication for mobile
   - Organization/Space model matches Dhanam's multi-tenancy

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Janua Platform                    │
│                 https://auth.madfam.io              │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  OIDC    │  │  User    │  │  Organization    │  │
│  │  Server  │  │  Mgmt    │  │  Management      │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  2FA     │  │  Session │  │  Billing         │  │
│  │  (TOTP)  │  │  Mgmt    │  │  Integration     │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │         Dhanam API            │
        │  JWT Validation + Guards      │
        └───────────────────────────────┘
```

### Authentication Flow

```
1. User visits app.dhan.am/login
2. @janua/react-sdk <SignIn /> component renders
3. User authenticates via Janua (email/password, social, or 2FA)
4. SDK handles PKCE: redirect to auth.madfam.io/authorize → callback with ?code=
5. SDK exchanges authorization code for tokens internally
6. JanuaAuthBridge syncs tokens to Zustand store → sets auth-storage cookie
7. Subsequent API requests include JWT in Authorization header
8. JwtAuthGuard validates on each request; JIT provisions user if new
```

### Token Strategy

| Token Type         | Lifetime   | Storage         | Purpose            |
| ------------------ | ---------- | --------------- | ------------------ |
| Access Token (JWT) | 15 minutes | httpOnly cookie | API authentication |
| Refresh Token      | 30 days    | httpOnly cookie | Token renewal      |
| ID Token           | 15 minutes | Not stored      | Initial user info  |

### JWT Claims

```typescript
interface JanuaJwtPayload {
  sub: string; // User ID
  email: string;
  email_verified: boolean;
  name: string;
  aud: string; // Per-client audience (e.g., 'dhanam-api')
  org_id: string; // Janua organization (maps to Space)
  roles: string[]; // ['user', 'admin', 'premium']
  tier: 'community' | 'pro' | 'enterprise';
  sub_status: 'active' | 'inactive' | 'suspended';
  is_admin: boolean;
  mfa_enabled: boolean;
  iat: number;
  exp: number;
  iss: 'https://auth.madfam.io';
  jti: string; // Unique token identifier
}
```

### Per-Client Audience Claim

Each OAuth client registered with Janua receives a unique `aud` (audience) claim
in issued tokens. Dhanam's registered audience is `dhanam-api`. The Janua strategy
validates this claim to ensure tokens issued for other MADFAM apps (e.g., Enclii,
Tezca) cannot be used to access Dhanam's API.

**Default**: `JANUA_AUDIENCE=dhanam-api` (set in `.env.example` and as fallback in
`janua.strategy.ts`)

### SDK Integration (March 2026)

The frontend uses `@janua/react-sdk@0.1.1` for all authentication UI and state
management. The SDK provides `<SignIn />`, `<SignUp />`, and `<UserButton />`
components that handle PKCE, social login, token refresh, and session management
internally.

**Auth pages**: Login and register pages render SDK components instead of custom
forms. The SDK handles the full OIDC flow (PKCE code exchange, token storage,
session refresh) without custom PKCE helpers. The auth callback page
(`/auth/callback`) is a simple loading spinner — the SDK's `JanuaProvider`
intercepts the `?code=` parameter and exchanges it automatically.

**Bridge architecture**: The `JanuaAuthBridge` component in
`apps/web/src/providers/JanuaAuthBridge.tsx` wraps `JanuaProvider` and syncs
Janua auth state with Dhanam's local Zustand store via `JanuaAuthSync`. This
component uses SDK hooks (`useAuth`, `useSession`, `useUser`) to read auth state
and calls Zustand's `setAuth(user, tokens)` to keep the `auth-storage` cookie
and all 38+ consumer components working unchanged.

**Demo mode**: The bridge preserves authentication for demo users (authenticated
via Dhanam's demo API, not Janua SSO). Detected via `demo-mode=true` cookie.
When the SDK reports no active session but the demo cookie is present, auth is
not cleared.

**Dashboard header**: The `<UserButton />` component from the SDK is rendered in
the dashboard header alongside the existing dropdown menu, providing Janua-managed
profile settings, security, and logout.

### Space Loading Race Condition Fix (March 2026)

A race condition caused first-time SSO users to see an empty "Get Started" state
instead of their financial data. Three changes address this:

1. **Early space fetch in layout**: `DashboardLayout` (`apps/web/src/app/(dashboard)/layout.tsx`)
   now calls `useSpaces()` before rendering child pages. React Query deduplicates
   by key, so the header's existing `useSpaces()` call does not double-fetch.

2. **Loading skeleton instead of empty state**: The dashboard page now distinguishes
   "spaces still loading" from "no spaces exist". While spaces load, a skeleton is
   shown instead of the misleading `<EmptyState />`.

3. **No synthetic space IDs**: `JanuaAuthBridge` previously injected a fake
   `personal-${januaUser.id}` space into the auth state. This ID never matched the
   real UUID from JIT provisioning, so `useSpaceStore.currentSpace` would fail to
   validate against the API response. The bridge now sets `spaces: []` and lets
   `useSpaces()` populate the store from the API.

### Transactional JIT Provisioning (March 2026)

The Janua strategy's JIT provisioning (`janua.strategy.ts`) now wraps user creation
and default space creation in a single `prisma.$transaction()`. Previously these were
separate calls — if space creation failed, the user was left without a space (orphaned).
The outer try/catch is preserved: if the entire transaction fails, the user still
receives a valid JWT and the frontend shows "Create First Space".

### Auth State Guard (March 2026)

The `JanuaAuthSync` component inside `JanuaAuthBridge` guards against clearing
valid auth sessions that `@janua/react-sdk` cannot detect. Two legitimate cases:

1. **Direct PKCE login**: Tokens stored in `localStorage` via the auth callback
   (not through the SDK's session management). Detected via presence of
   `janua_access_token` in `localStorage`.
2. **Demo mode**: User authenticated via Dhanam's demo API, not Janua SSO.
   Detected via `demo-mode=true` cookie.

The `AuthProvider` (token refresh timer) no longer calls `clearAuth()` on refresh
failure. Instead it logs a warning and defers re-authentication to `JanuaAuthSync`
or the next API call. This prevents the dashboard from flashing back to login when
a refresh attempt fails but the access token is still valid.

### Security Features

1. **Short-Lived Access Tokens**: 15-minute expiry limits exposure
2. **Refresh Token Rotation**: New refresh token on each use
3. **TOTP 2FA**: Required for admin operations, optional for users
4. **Session Binding**: Tokens bound to device fingerprint
5. **Revocation**: Immediate token revocation on logout/password change

## Consequences

### Positive

- **Unified Identity**: Single login for all MADFAM products
- **Cost Savings**: No external auth provider fees
- **Full Control**: Can add features specific to financial apps
- **Data Privacy**: User data stays within MADFAM infrastructure
- **Compliance**: Direct control over audit and compliance

### Negative

- **Development Overhead**: Janua team must maintain auth infrastructure
- **Single Point of Failure**: Janua outage affects all MADFAM products
- **Feature Velocity**: May lag behind commercial auth providers
- **Expertise Required**: Security expertise needed in-house

### Mitigations

- Janua deployed with high availability (multi-region)
- Regular security audits by external firm
- Feature roadmap aligned with MADFAM product needs
- Emergency fallback to external provider documented

## Implementation

### Configuration

```env
# .env
JANUA_ISSUER=https://auth.madfam.io
JANUA_CLIENT_ID=dhanam_web_client
JANUA_CLIENT_SECRET=xxx
JANUA_JWKS_URL=https://auth.madfam.io/.well-known/jwks.json
```

### NestJS Integration

```typescript
// apps/api/src/core/auth/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Validates JWT against Janua JWKS
}

// apps/api/src/core/auth/strategies/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: 'https://auth.madfam.io',
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        jwksUri: 'https://auth.madfam.io/.well-known/jwks.json',
      }),
    });
  }
}
```

### Billing Integration

Janua also handles billing provider routing (see JanuaBillingService):

- Creates customers in correct payment provider
- Manages subscription lifecycle
- Unified webhooks for payment events

## Related Decisions

- [ADR-005](./005-enclii-deployment.md): Enclii deployment (also uses Janua)
- [ADR-001](./001-nestjs-fastify.md): NestJS guards architecture

## References

- [Janua Documentation](https://docs.janua.dev) (internal)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
