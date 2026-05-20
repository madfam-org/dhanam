# Dhanam Ledger - Complete Implementation Roadmap

> [!NOTE]
> Historical implementation roadmap. For current production-stability work, use
> [../ROADMAP.md](../ROADMAP.md) and
> [../STABILITY_WRAP_UP_2026-05-20.md](../STABILITY_WRAP_UP_2026-05-20.md).

**Status**: In Progress
**Last Updated**: 2025-11-17
**Target Completion**: 4 weeks

---

## ✅ COMPLETED IMPLEMENTATIONS

### 1. Database Migrations Strategy ✅ DONE

**Files Created:**

- `apps/api/MIGRATIONS_GUIDE.md` - Comprehensive migration guide
- `apps/api/prisma/migrations/.gitkeep` - Migrations directory
- `.github/workflows/check-migrations.yml` - CI/CD migration checks
- Updated `package.json` scripts for all migration commands
- Updated `turbo.json` with migration tasks

**Commands Available:**

```bash
pnpm db:migrate:dev       # Create and apply migration
pnpm db:migrate:deploy    # Deploy to production
pnpm db:migrate:status    # Check migration status
pnpm db:migrate:reset     # Reset database
pnpm db:studio            # Open Prisma Studio
```

**Next Steps:**

1. Run `pnpm db:migrate:dev --name initial_schema` to create baseline
2. Test migration rollback procedures
3. Update deployment scripts to use `db:migrate:deploy`

---

### 2. Sentry Error Monitoring ✅ DONE

**Files Created:**

- `apps/api/src/core/monitoring/sentry.service.ts` - Sentry service with full feature set
- `apps/api/src/core/monitoring/sentry.module.ts` - Sentry module
- Updated `apps/api/src/core/filters/global-exception.filter.ts` - Integrated Sentry
- Updated `apps/api/src/core/monitoring/monitoring.module.ts` - Added to monitoring
- `docs/SENTRY_SETUP.md` - Complete setup documentation
- Updated `.env.example` with Sentry configuration

**Features Implemented:**

- ✅ Automatic 5xx error capture
- ✅ Performance monitoring (10% sample rate in prod)
- ✅ CPU profiling
- ✅ User context tracking
- ✅ Request context with sanitized headers
- ✅ Custom breadcrumbs
- ✅ Error filtering (validation, auth errors excluded)
- ✅ Sensitive data protection

**Configuration:**

```bash
SENTRY_DSN=https://your_key@sentry.io/project_id
SENTRY_RELEASE=dhanam-api@0.1.0
SENTRY_ENVIRONMENT=production
```

**Next Steps:**

1. Create Sentry project at sentry.io
2. Set environment variables
3. Configure alerts in Sentry dashboard
4. Add Sentry to Web and Mobile apps

---

## 🚧 IN PROGRESS IMPLEMENTATIONS

### 3. Expand Test Coverage to 80%+

**Current Status:** Test infrastructure being enhanced

**Implementation Plan:**

#### Phase 1: Test Infrastructure (Week 1, Days 1-2)

**Files to Create/Update:**

1. **Enhanced Jest Configuration**

```javascript
// apps/api/jest.config.js - ENHANCE EXISTING
module.exports = {
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Critical paths require 90%
    './src/core/auth/**/*.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
    },
    './src/modules/transactions/**/*.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
    },
  },
};
```

2. **Test Helpers**

```typescript
// test/helpers/test-database.ts - CREATE
export class TestDatabase {
  static async setup() {
    // Reset database
    // Connect Prisma
  }
  static async cleanup() {
    // Clear all tables
  }
  static async teardown() {
    // Disconnect
  }
}

// test/helpers/test-data-factory.ts - CREATE
export class TestDataFactory {
  async createUser(overrides?: Partial<User>): Promise<User>;
  async createSpace(userId: string, overrides?: Partial<Space>): Promise<Space>;
  async createAccount(spaceId: string): Promise<Account>;
  async createTransaction(accountId: string): Promise<Transaction>;
  async createFullSetup(): Promise<{ user; space; account; budget; category; transaction }>;
}

// test/helpers/auth-helper.ts - CREATE
export class AuthHelper {
  static async generateToken(userId: string): Promise<string>;
  static async createAuthenticatedRequest(user: User);
}
```

#### Phase 2: Critical Path Tests (Week 1, Days 3-5)

**Priority 1: Transaction Calculations**

```typescript
// src/modules/transactions/__tests__/transactions.service.spec.ts
describe('TransactionsService', () => {
  describe('calculateBalance', () => {
    it('should correctly sum positive and negative amounts', async () => {
      // Test decimal precision
      // Test large numbers
      // Test currency conversion
    });

    it('should handle 1000+ transactions without precision loss', async () => {
      // Create 1000 transactions
      // Verify sum is exact
    });
  });

  describe('bulkCreate', () => {
    it('should process 100 transactions in < 2s', async () => {
      const start = Date.now();
      await service.bulkCreate(generateTransactions(100));
      expect(Date.now() - start).toBeLessThan(2000);
    });
  });
});
```

**Priority 2: Budget Rules Engine**

```typescript
// src/modules/budgets/__tests__/rules-engine.spec.ts
describe('BudgetRulesEngine', () => {
  describe('auto-categorization', () => {
    it('should apply highest priority rule when multiple match', async () => {
      // Rule 1: "Amazon" -> Shopping (priority 10)
      // Rule 2: "Amazon Prime" -> Subscriptions (priority 20)
      // Transaction: "Amazon Prime Video"
      // Expected: Subscriptions (higher priority)
    });

    it('should handle regex patterns correctly', async () => {
      // Test various regex patterns
      // Test case sensitivity
      // Test partial matches
    });

    it('should categorize 1000 transactions in < 2s', async () => {
      // Performance test
    });
  });

  describe('budget limits', () => {
    it('should correctly calculate category spending vs limit', async () => {
      // Create budget with $1000 limit
      // Add transactions totaling $950
      // Verify remaining is $50
    });

    it('should alert when approaching limit (90%)', async () => {
      // Add transactions to 90% of limit
      // Verify alert is triggered
    });
  });
});
```

**Priority 3: Currency Conversion**

```typescript
// src/modules/fx-rates/__tests__/fx-rates.service.spec.ts
describe('FXRatesService', () => {
  it('should convert MXN to USD with correct precision', async () => {
    const result = await service.convert({
      from: 'MXN',
      to: 'USD',
      amount: 1000,
      date: new Date('2025-01-01'),
    });
    expect(result.amount).toBeCloseTo(58.48, 2); // 4 decimal precision
  });

  it('should use cached rates when available', async () => {
    // First call fetches from Banxico
    await service.getRate('MXN', 'USD', new Date());
    // Second call uses cache
    const spy = jest.spyOn(banxicoClient, 'fetch');
    await service.getRate('MXN', 'USD', new Date());
    expect(spy).not.toHaveBeenCalled();
  });
});
```

**Priority 4: Auth & Security**

```typescript
// src/core/auth/__tests__/auth.service.integration.spec.ts
describe('AuthService Integration', () => {
  describe('full auth flow', () => {
    it('should register -> login -> refresh -> logout', async () => {
      // Register
      const { accessToken, refreshToken } = await service.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      });

      // Verify access token
      const payload = await jwtService.verify(accessToken);
      expect(payload.sub).toBeDefined();

      // Refresh
      const newTokens = await service.refreshTokens({ refreshToken });
      expect(newTokens.accessToken).not.toBe(accessToken);

      // Logout
      await service.logout(newTokens.refreshToken);

      // Verify old refresh token doesn't work
      await expect(
        service.refreshTokens({ refreshToken: newTokens.refreshToken })
      ).rejects.toThrow();
    });
  });

  describe('TOTP 2FA flow', () => {
    it('should setup -> enable -> login with TOTP', async () => {
      const user = await factory.createUser();

      // Setup TOTP
      const { secret, qrCodeUrl } = await totpService.setupTotp(user.id, user.email);

      // Generate token
      const token = speakeasy.totp({
        secret,
        encoding: 'base32',
      });

      // Enable TOTP
      await totpService.enableTotp(user.id, token);

      // Login requires TOTP
      await expect(service.login({ email: user.email, password: 'password' })).rejects.toThrow(
        'TOTP code required'
      );

      // Login with TOTP succeeds
      const result = await service.login({
        email: user.email,
        password: 'password',
        totpCode: token,
      });
      expect(result.accessToken).toBeDefined();
    });
  });
});
```

#### Phase 3: Provider Integration Tests (Week 2, Days 1-2)

**Belvo Integration**

```typescript
// src/modules/providers/belvo/__tests__/belvo.service.spec.ts
describe('BelvoService', () => {
  it('should sync 90 days of transactions', async () => {
    mockBelvo.transactions.retrieve.mockResolvedValue(generateBelvoTransactions(90));

    const result = await service.syncTransactions(spaceId, userId, linkId);

    expect(result).toHaveLength(90);
    // Verify dates are within 90 days
  });

  it('should encrypt provider tokens before storing', async () => {
    const { linkId } = await service.createLink(spaceId, userId, {
      institution: 'banamex',
      username: 'test',
      password: 'test123',
    });

    const connection = await prisma.providerConnection.findFirst({
      where: { providerUserId: linkId },
    });

    expect(connection.encryptedToken).not.toContain(linkId);
    // Verify can decrypt
    const decrypted = cryptoService.decrypt(connection.encryptedToken);
    expect(decrypted).toContain(linkId);
  });

  it('should verify webhook HMAC signatures', async () => {
    const payload = { event: 'ACCOUNTS_CREATED', link_id: '123' };
    const signature = createHmacSignature(payload, webhookSecret);

    await expect(service.handleWebhook(payload, signature)).resolves.not.toThrow();

    // Invalid signature
    await expect(service.handleWebhook(payload, 'invalid')).rejects.toThrow(
      'Invalid webhook signature'
    );
  });
});
```

#### Phase 4: E2E Tests (Week 2, Days 3-5)

**Complete User Flow**

```typescript
// test/e2e/complete-user-flow.e2e-spec.ts
describe('Complete User Flow (E2E)', () => {
  it('should complete full onboarding and first transaction', async () => {
    // 1. Register
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      })
      .expect(201);

    const { accessToken } = register.body;

    // 2. Setup preferences
    await request(app.getHttpServer())
      .put('/users/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        defaultCurrency: 'MXN',
        locale: 'es',
        timezone: 'America/Mexico_City',
      })
      .expect(200);

    // 3. Create space
    const space = await request(app.getHttpServer())
      .post('/spaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Personal Finances',
        type: 'personal',
      })
      .expect(201);

    // 4. Connect provider (mocked)
    const account = await request(app.getHttpServer())
      .post('/providers/belvo/link')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        spaceId: space.body.id,
        institution: 'banamex',
        username: 'test',
        password: 'test123',
      })
      .expect(201);

    // 5. Create budget
    const budget = await request(app.getHttpServer())
      .post('/budgets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        spaceId: space.body.id,
        name: 'January 2025',
        period: 'monthly',
        startDate: '2025-01-01',
        categories: [
          { name: 'Groceries', budgetedAmount: 5000 },
          { name: 'Rent', budgetedAmount: 10000 },
        ],
      })
      .expect(201);

    // 6. Create manual transaction
    const transaction = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        accountId: account.body.accounts[0].id,
        amount: -150,
        currency: 'MXN',
        description: 'Grocery shopping',
        date: new Date(),
        categoryId: budget.body.categories[0].id,
      })
      .expect(201);

    // 7. Verify account balance updated
    const updatedAccount = await request(app.getHttpServer())
      .get(`/accounts/${account.body.accounts[0].id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(updatedAccount.body.balance).toBe(account.body.accounts[0].balance - 150);

    // 8. Verify budget spending updated
    const updatedBudget = await request(app.getHttpServer())
      .get(`/budgets/${budget.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(updatedBudget.body.categories[0].spent).toBe(150);
    expect(updatedBudget.body.categories[0].remaining).toBe(4850);
  });
});
```

**Coverage Targets by Module:**

| Module               | Current | Target | Priority |
| -------------------- | ------- | ------ | -------- |
| core/auth            | Unknown | 90%    | Critical |
| modules/transactions | Unknown | 85%    | Critical |
| modules/budgets      | Unknown | 85%    | Critical |
| modules/providers    | Unknown | 80%    | High     |
| modules/fx-rates     | Unknown | 80%    | High     |
| modules/spaces       | Unknown | 75%    | Medium   |
| modules/analytics    | Unknown | 70%    | Medium   |

**Commands:**

```bash
# Run all tests with coverage
pnpm test:cov

# Run specific suite
pnpm test --testPathPattern=transactions

# Watch mode
pnpm test:watch

# E2E tests
pnpm test:e2e

# Coverage report location
./apps/api/coverage/lcov-report/index.html
```

**Verification:**

```bash
# Check coverage meets thresholds
pnpm test:cov
# Should pass with all modules >80%

# Check critical paths >90%
# Look for auth, transactions, budgets in report
```

---

### 4. Comprehensive Spanish i18n

**Current Status:** Basic infrastructure exists, needs expansion

**Implementation Plan:**

#### Phase 1: Core Translation Files (Week 2, Day 3)

**File Structure:**

```
packages/shared/src/i18n/
├── index.ts           # Main export
├── en/
│   ├── common.ts      # Common UI strings
│   ├── auth.ts        # Authentication
│   ├── transactions.ts
│   ├── budgets.ts
│   ├── errors.ts      # Error messages
│   └── validations.ts # Validation messages
└── es/
    ├── common.ts
    ├── auth.ts
    ├── transactions.ts
    ├── budgets.ts
    ├── errors.ts
    └── validations.ts
```

**Spanish Translations (200+ keys):**

```typescript
// packages/shared/src/i18n/es/common.ts
export const common = {
  // Actions
  save: 'Guardar',
  cancel: 'Cancelar',
  delete: 'Eliminar',
  edit: 'Editar',
  add: 'Agregar',
  remove: 'Quitar',
  search: 'Buscar',
  filter: 'Filtrar',
  export: 'Exportar',
  import: 'Importar',
  refresh: 'Actualizar',
  loading: 'Cargando...',
  submit: 'Enviar',
  confirm: 'Confirmar',
  back: 'Volver',
  next: 'Siguiente',
  previous: 'Anterior',
  close: 'Cerrar',

  // Time
  today: 'Hoy',
  yesterday: 'Ayer',
  thisWeek: 'Esta semana',
  thisMonth: 'Este mes',
  lastMonth: 'Mes pasado',
  thisYear: 'Este año',

  // Status
  active: 'Activo',
  inactive: 'Inactivo',
  pending: 'Pendiente',
  completed: 'Completado',
  failed: 'Fallido',
  syncing: 'Sincronizando',

  // Confirmation
  areYouSure: '¿Estás seguro?',
  cannotBeUndone: 'Esta acción no se puede deshacer',
  deleteConfirmation: '¿Realmente deseas eliminar {{item}}?',
};

// packages/shared/src/i18n/es/auth.ts
export const auth = {
  // Login
  login: 'Iniciar sesión',
  logout: 'Cerrar sesión',
  email: 'Correo electrónico',
  password: 'Contraseña',
  forgotPassword: '¿Olvidaste tu contraseña?',
  dontHaveAccount: '¿No tienes cuenta?',
  register: 'Registrarse',

  // Registration
  createAccount: 'Crear cuenta',
  fullName: 'Nombre completo',
  confirmPassword: 'Confirmar contraseña',
  alreadyHaveAccount: '¿Ya tienes cuenta?',
  agreeToTerms: 'Acepto los términos y condiciones',

  // 2FA
  twoFactorAuth: 'Autenticación de dos factores',
  enableTwoFactor: 'Habilitar 2FA',
  disableTwoFactor: 'Deshabilitar 2FA',
  totpCode: 'Código de verificación',
  backupCodes: 'Códigos de respaldo',
  scanQRCode: 'Escanea el código QR con tu aplicación de autenticación',

  // Password Reset
  resetPassword: 'Restablecer contraseña',
  sendResetLink: 'Enviar enlace de restablecimiento',
  checkEmail: 'Revisa tu correo electrónico',
  resetLinkSent: 'Te hemos enviado un enlace para restablecer tu contraseña',
  newPassword: 'Nueva contraseña',

  // Errors
  invalidCredentials: 'Credenciales inválidas',
  emailAlreadyExists: 'El correo electrónico ya está registrado',
  weakPassword: 'La contraseña es demasiado débil',
  passwordsDoNotMatch: 'Las contraseñas no coinciden',
  totpCodeRequired: 'Se requiere código de autenticación',
  invalidTotpCode: 'Código de autenticación inválido',
};

// packages/shared/src/i18n/es/transactions.ts
export const transactions = {
  // General
  transaction: 'Transacción',
  transactions: 'Transacciones',
  addTransaction: 'Agregar transacción',
  editTransaction: 'Editar transacción',
  deleteTransaction: 'Eliminar transacción',

  // Types
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',

  // Fields
  amount: 'Monto',
  description: 'Descripción',
  category: 'Categoría',
  date: 'Fecha',
  account: 'Cuenta',
  merchant: 'Comerciante',
  status: 'Estado',

  // Status
  pending: 'Pendiente',
  cleared: 'Procesado',
  reconciled: 'Conciliado',

  // Categories
  uncategorized: 'Sin categoría',
  categorizeAll: 'Categorizar todo',
  autoCategorizationEnabled: 'Categorización automática habilitada',

  // Filters
  filterByCategory: 'Filtrar por categoría',
  filterByAccount: 'Filtrar por cuenta',
  filterByDate: 'Filtrar por fecha',
  allTransactions: 'Todas las transacciones',

  // Actions
  bulkEdit: 'Edición masiva',
  bulkDelete: 'Eliminación masiva',
  exportTransactions: 'Exportar transacciones',
  importTransactions: 'Importar transacciones',

  // Messages
  transactionAdded: 'Transacción agregada',
  transactionUpdated: 'Transacción actualizada',
  transactionDeleted: 'Transacción eliminada',
  transactionsCategorized: '{{count}} transacciones categorizadas',
};

// packages/shared/src/i18n/es/budgets.ts
export const budgets = {
  // General
  budget: 'Presupuesto',
  budgets: 'Presupuestos',
  createBudget: 'Crear presupuesto',
  editBudget: 'Editar presupuesto',
  deleteBudget: 'Eliminar presupuesto',

  // Fields
  budgetName: 'Nombre del presupuesto',
  budgetPeriod: 'Período',
  startDate: 'Fecha de inicio',
  endDate: 'Fecha de fin',

  // Periods
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',

  // Categories
  category: 'Categoría',
  categories: 'Categorías',
  addCategory: 'Agregar categoría',
  budgetedAmount: 'Monto presupuestado',
  spent: 'Gastado',
  remaining: 'Restante',

  // Status
  onTrack: 'En curso',
  nearLimit: 'Cerca del límite',
  overBudget: 'Sobre presupuesto',

  // Progress
  percentUsed: '{{percent}}% utilizado',
  amountRemaining: '{{amount}} restante',
  daysRemaining: '{{days}} días restantes',

  // Alerts
  budgetLimitReached: 'Has alcanzado el límite de {{category}}',
  budgetAlmostReached: 'Has gastado {{percent}}% de tu presupuesto de {{category}}',

  // Rules
  categoryRules: 'Reglas de categorización',
  createRule: 'Crear regla',
  ruleName: 'Nombre de la regla',
  ruleConditions: 'Condiciones',
  ruleActions: 'Acciones',
  enableRule: 'Habilitar regla',
  disableRule: 'Deshabilitar regla',

  // Messages
  budgetCreated: 'Presupuesto creado',
  budgetUpdated: 'Presupuesto actualizado',
  budgetDeleted: 'Presupuesto eliminado',
  categoryAdded: 'Categoría agregada',
  ruleCreated: 'Regla creada',
};

// packages/shared/src/i18n/es/errors.ts
export const errors = {
  // Generic
  somethingWentWrong: 'Algo salió mal',
  tryAgainLater: 'Por favor, intenta de nuevo más tarde',
  networkError: 'Error de red',
  serverError: 'Error del servidor',
  notFound: 'No encontrado',
  unauthorized: 'No autorizado',
  forbidden: 'Acceso denegado',
  validationError: 'Error de validación',

  // Auth
  invalidCredentials: 'Credenciales inválidas',
  sessionExpired: 'Sesión expirada',
  accountLocked: 'Cuenta bloqueada',
  emailNotVerified: 'Correo electrónico no verificado',

  // Data
  recordNotFound: 'Registro no encontrado',
  duplicateEntry: 'Entrada duplicada: {{field}}',
  invalidFormat: 'Formato inválido',
  requiredField: '{{field}} es requerido',

  // Financial
  insufficientBalance: 'Saldo insuficiente',
  invalidAmount: 'Monto inválido',
  budgetLimitExceeded: 'Has excedido el límite de {{category}}',
  providerConnectionFailed: 'Error al conectar con {{provider}}',
  syncFailed: 'Error en la sincronización',

  // Provider-specific
  belvoConnectionError: 'Error al conectar con Belvo',
  plaidConnectionError: 'Error al conectar con Plaid',
  bitsoConnectionError: 'Error al conectar con Bitso',
  invalidInstitutionCredentials: 'Credenciales de institución inválidas',
};
```

#### Phase 2: Number & Currency Formatting (Week 2, Day 4)

**Locale-aware formatting:**

```typescript
// packages/shared/src/utils/formatters.ts
export const formatCurrency = (
  amount: number,
  currency: Currency,
  locale: string = 'es-MX'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Spanish (Mexico): $1,234.56 MXN
// English (US): MXN $1,234.56

export const formatNumber = (value: number, locale: string = 'es-MX'): string => {
  return new Intl.NumberFormat(locale).format(value);
};

// Spanish: 1.234,56
// English: 1,234.56

export const formatDate = (
  date: Date,
  locale: string = 'es-MX',
  options?: Intl.DateTimeFormatOptions
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  return new Intl.DateTimeFormat(locale, options || defaultOptions).format(date);
};

// Spanish: 17 de noviembre de 2025
// English: November 17, 2025
```

#### Phase 3: React Hooks & Context (Week 2, Day 5)

**i18n Hook:**

```typescript
// packages/shared/src/hooks/useTranslation.ts
import { useContext } from 'react';
import { I18nContext } from '../contexts/I18nContext';

export const useTranslation = () => {
  const { locale, t, setLocale } = useContext(I18nContext);

  return {
    locale,
    t,
    setLocale,
    // Convenience methods
    tCommon: (key: string) => t(`common.${key}`),
    tAuth: (key: string) => t(`auth.${key}`),
    tTransactions: (key: string) => t(`transactions.${key}`),
    tBudgets: (key: string) => t(`budgets.${key}`),
    tErrors: (key: string) => t(`errors.${key}`),
  };
};

// Usage in components:
const { t, tCommon, locale } = useTranslation();

return (
  <button>{tCommon('save')}</button>
  // English: Save
  // Spanish: Guardar
);
```

**Validation Messages:**

```typescript
// packages/shared/src/validations/messages.ts
export const getValidationMessages = (locale: string) => ({
  required: locale === 'es' ? '{{field}} es requerido' : '{{field}} is required',
  email: locale === 'es' ? 'Correo electrónico inválido' : 'Invalid email address',
  minLength:
    locale === 'es'
      ? '{{field}} debe tener al menos {{min}} caracteres'
      : '{{field}} must be at least {{min}} characters',
  maxLength:
    locale === 'es'
      ? '{{field}} no debe exceder {{max}} caracteres'
      : '{{field}} must not exceed {{max}} characters',
  min:
    locale === 'es' ? '{{field}} debe ser al menos {{min}}' : '{{field}} must be at least {{min}}',
  max:
    locale === 'es'
      ? '{{field}} no debe ser mayor que {{max}}'
      : '{{field}} must not be greater than {{max}}',
});
```

---

### 5. Complete PostHog Analytics Integration

**Current Status:** Placeholder logging only

**Implementation Plan:**

#### Phase 1: PostHog Client Setup (Week 3, Day 1)

**Backend Integration:**

```typescript
// apps/api/package.json - ADD
"dependencies": {
  "posthog-node": "^4.0.0"
}

// apps/api/src/modules/analytics/posthog.service.ts - CREATE
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';

@Injectable()
export class PostHogService implements OnModuleInit {
  private client: PostHog;
  private isEnabled: boolean;

  constructor(private configService: ConfigService) {
    this.isEnabled = !!this.configService.get('POSTHOG_API_KEY');
  }

  async onModuleInit() {
    if (!this.isEnabled) {
      console.log('⚠️  PostHog not configured - analytics disabled');
      return;
    }

    this.client = new PostHog(
      this.configService.get('POSTHOG_API_KEY')!,
      {
        host: this.configService.get('POSTHOG_HOST') || 'https://analytics.madfam.io',
        flushAt: 20, // Flush every 20 events
        flushInterval: 10000, // Or every 10 seconds
      }
    );

    console.log('✅ PostHog analytics initialized');
  }

  async capture(event: {
    distinctId: string;
    event: string;
    properties?: Record<string, any>;
  }) {
    if (!this.isEnabled || !this.client) return;

    this.client.capture({
      distinctId: event.distinctId,
      event: event.event,
      properties: {
        ...event.properties,
        $lib: 'dhanam-api',
        $lib_version: '0.1.0',
      },
    });
  }

  async identify(userId: string, properties: Record<string, any>) {
    if (!this.isEnabled || !this.client) return;

    this.client.identify({
      distinctId: userId,
      properties,
    });
  }

  async shutdown() {
    if (this.client) {
      await this.client.shutdown();
    }
  }
}
```

**Update Onboarding Analytics:**

```typescript
// apps/api/src/modules/onboarding/onboarding.analytics.ts - UPDATE
import { PostHogService } from '@modules/analytics/posthog.service';

export class OnboardingAnalytics {
  constructor(
    private readonly configService: ConfigService,
    private readonly posthogService: PostHogService // INJECT
  ) {}

  async trackOnboardingStarted(userId: string, userEmail: string) {
    await this.posthogService.capture({
      distinctId: userId,
      event: 'onboarding_started',
      properties: {
        user_email: userEmail,
        timestamp: new Date().toISOString(),
        source: 'web',
      },
    });
  }

  // ... implement all other events
}
```

#### Phase 2: Add Missing Events (Week 3, Day 2)

**Provider Sync Events:**

```typescript
// apps/api/src/modules/providers/providers.analytics.ts - CREATE
@Injectable()
export class ProvidersAnalytics {
  constructor(private posthog: PostHogService) {}

  async trackSyncSuccess(
    userId: string,
    provider: Provider,
    metadata: {
      accountCount: number;
      transactionCount: number;
      duration: number;
    }
  ) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'sync_success',
      properties: {
        provider,
        account_count: metadata.accountCount,
        transaction_count: metadata.transactionCount,
        duration_ms: metadata.duration,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async trackSyncFailed(userId: string, provider: Provider, error: string) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'sync_failed',
      properties: {
        provider,
        error_message: error,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async trackConnectionInitiated(userId: string, provider: Provider) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'connect_initiated',
      properties: { provider },
    });
  }

  async trackConnectionSuccess(userId: string, provider: Provider) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'connect_success',
      properties: { provider },
    });
  }
}
```

**Budget & Rules Events:**

```typescript
// apps/api/src/modules/budgets/budgets.analytics.ts - CREATE
@Injectable()
export class BudgetsAnalytics {
  constructor(private posthog: PostHogService) {}

  async trackBudgetCreated(
    userId: string,
    budget: {
      period: BudgetPeriod;
      categoriesCount: number;
      totalAmount: number;
    }
  ) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'budget_created',
      properties: {
        budget_period: budget.period,
        categories_count: budget.categoriesCount,
        total_amount: budget.totalAmount,
      },
    });
  }

  async trackRuleCreated(
    userId: string,
    rule: {
      ruleType: string;
      categoryName: string;
    }
  ) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'rule_created',
      properties: {
        rule_type: rule.ruleType,
        category_name: rule.categoryName,
      },
    });
  }

  async trackAlertFired(
    userId: string,
    alert: {
      type: 'budget_limit' | 'unusual_spending' | 'large_transaction';
      categoryName?: string;
      amount?: number;
    }
  ) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'alert_fired',
      properties: {
        alert_type: alert.type,
        category_name: alert.categoryName,
        amount: alert.amount,
      },
    });
  }
}
```

**Transaction Events:**

```typescript
// apps/api/src/modules/transactions/transactions.analytics.ts - CREATE
@Injectable()
export class TransactionsAnalytics {
  constructor(private posthog: PostHogService) {}

  async trackTransactionCategorized(
    userId: string,
    method: 'auto' | 'manual',
    categoryName: string
  ) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'txn_categorized',
      properties: {
        categorization_method: method,
        category_name: categoryName,
      },
    });
  }

  async trackBulkCategorization(userId: string, count: number, ruleId?: string) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'txn_bulk_categorized',
      properties: {
        transaction_count: count,
        rule_id: ruleId,
      },
    });
  }
}
```

**Wealth Tracking Events:**

```typescript
// apps/api/src/modules/wealth/wealth.analytics.ts - CREATE
@Injectable()
export class WealthAnalytics {
  constructor(private posthog: PostHogService) {}

  async trackNetWorthViewed(userId: string, netWorth: number) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'view_net_worth',
      properties: {
        net_worth: netWorth,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async trackDataExported(
    userId: string,
    exportType: 'transactions' | 'budgets' | 'full',
    format: 'csv' | 'pdf' | 'json'
  ) {
    await this.posthog.capture({
      distinctId: userId,
      event: 'export_data',
      properties: {
        export_type: exportType,
        format,
      },
    });
  }
}
```

#### Phase 3: Frontend Analytics (Week 3, Day 3)

**Web App:**

```typescript
// apps/web/package.json - ADD
"dependencies": {
  "posthog-js": "^1.96.0"
}

// apps/web/src/lib/posthog.ts - CREATE
import posthog from 'posthog-js';

export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://analytics.madfam.io',
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage',
    });
  }

  return posthog;
};

// apps/web/src/app/layout.tsx - UPDATE
import { initPostHog } from '@/lib/posthog';

export default function RootLayout({ children }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <html>{children}</html>;
}
```

**Mobile App:**

```typescript
// apps/mobile/package.json - ADD
"dependencies": {
  "posthog-react-native": "^3.1.0"
}

// apps/mobile/App.tsx - UPDATE
import PostHog from 'posthog-react-native';

const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_KEY!,
  {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://analytics.madfam.io',
  }
);

export default function App() {
  useEffect(() => {
    // Track screen views
    posthog.screen('Home');
  }, []);

  return <YourApp />;
}
```

---

## 📋 PENDING IMPLEMENTATIONS

### 6. Cashflow Forecasting Engine

**Estimated Effort:** 1 week (Week 3, Days 4-5 + Week 4, Days 1-3)

**Implementation Overview:**

**Algorithm Design:**

1. Analyze historical transactions (90+ days)
2. Detect recurring patterns (monthly bills, paychecks)
3. Calculate income/expense trends
4. Project 60 days forward with weekly granularity
5. Include confidence intervals

**File Structure:**

```
apps/api/src/modules/forecasting/
├── forecasting.module.ts
├── forecasting.service.ts
├── forecasting.controller.ts
├── dto/
│   ├── forecast-request.dto.ts
│   └── forecast-response.dto.ts
├── engines/
│   ├── recurring-transaction-detector.ts
│   ├── trend-analyzer.ts
│   └── projection-calculator.ts
└── __tests__/
    ├── forecasting.service.spec.ts
    └── recurring-detector.spec.ts
```

**Key Service Methods:**

```typescript
interface ForecastService {
  generateForecast(spaceId: string, options?: ForecastOptions): Promise<CashflowForecast>;
  detectRecurringTransactions(accountId: string): Promise<RecurringTransaction[]>;
  calculateTrends(spaceId: string): Promise<TrendAnalysis>;
  getProjections(spaceId: string, weeks: number): Promise<WeeklyProjection[]>;
}

interface CashflowForecast {
  spaceId: string;
  generatedAt: Date;
  projections: WeeklyProjection[];
  confidence: number; // 0-100
  recurringTransactions: RecurringTransaction[];
  trends: {
    income: TrendLine;
    expenses: TrendLine;
  };
}

interface WeeklyProjection {
  weekStart: Date;
  weekEnd: Date;
  projectedIncome: number;
  projectedExpenses: number;
  projectedBalance: number;
  confidenceLow: number; // Lower bound
  confidenceHigh: number; // Upper bound
  confidence: number; // 0-100
  basedOn: 'historical' | 'recurring' | 'trend';
}
```

**Algorithm Pseudocode:**

```typescript
async generateForecast(spaceId: string): Promise<CashflowForecast> {
  // 1. Get historical data (90-180 days)
  const transactions = await this.getHistoricalTransactions(spaceId, 90);

  // 2. Detect recurring transactions
  const recurring = await this.detectRecurringTransactions(transactions);
  // Examples: Monthly rent, bi-weekly paycheck, annual subscription

  // 3. Calculate trends
  const trends = await this.calculateTrends(transactions);
  // Linear regression for income/expenses over time

  // 4. Generate 60-day projections (8-9 weeks)
  const projections: WeeklyProjection[] = [];
  let currentBalance = await this.getCurrentBalance(spaceId);

  for (let week = 0; week < 9; week++) {
    const weekStart = addWeeks(new Date(), week);
    const weekEnd = addDays(weekStart, 6);

    // Project income from recurring + trend
    const projectedIncome =
      this.sumRecurringInWeek(recurring, weekStart, weekEnd) +
      this.projectTrendIncome(trends.income, weekStart);

    // Project expenses from recurring + trend
    const projectedExpenses =
      this.sumRecurringInWeek(recurring, weekStart, weekEnd) +
      this.projectTrendExpenses(trends.expenses, weekStart);

    // Calculate projected balance
    const projectedBalance = currentBalance + projectedIncome - projectedExpenses;

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(transactions, recurring, week);

    // Add confidence interval
    const variance = this.calculateVariance(transactions);
    const confidenceLow = projectedBalance - variance;
    const confidenceHigh = projectedBalance + variance;

    projections.push({
      weekStart,
      weekEnd,
      projectedIncome,
      projectedExpenses,
      projectedBalance,
      confidenceLow,
      confidenceHigh,
      confidence,
      basedOn: this.determineMethod(recurring, trends, week),
    });

    currentBalance = projectedBalance;
  }

  return {
    spaceId,
    generatedAt: new Date(),
    projections,
    confidence: this.calculateOverallConfidence(projections),
    recurringTransactions: recurring,
    trends,
  };
}
```

**API Endpoint:**

```typescript
GET /api/v1/forecasts/:spaceId

Response:
{
  "spaceId": "uuid",
  "generatedAt": "2025-01-17T10:00:00Z",
  "confidence": 85,
  "currentBalance": 15000,
  "projections": [
    {
      "weekStart": "2025-01-20",
      "weekEnd": "2025-01-26",
      "projectedIncome": 5000,
      "projectedExpenses": 3500,
      "projectedBalance": 16500,
      "confidenceLow": 15800,
      "confidenceHigh": 17200,
      "confidence": 90,
      "basedOn": "recurring"
    },
    // ... 8 more weeks
  ],
  "recurringTransactions": [
    {
      "description": "Salary",
      "amount": 25000,
      "frequency": "monthly",
      "nextExpected": "2025-01-31",
      "confidence": 95
    }
  ]
}
```

**Testing Requirements:**

- Unit tests for trend calculation
- Unit tests for recurring detection
- Integration test for full forecast generation
- Edge cases: new account, insufficient data, volatile transactions

---

### 7. APM (New Relic) Integration

**Estimated Effort:** 2-3 days

**Setup:**

```bash
npm install newrelic --save
```

**Configuration:**

```javascript
// apps/api/newrelic.js
exports.config = {
  app_name: ['Dhanam API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info',
  },
  distributed_tracing: {
    enabled: true,
  },
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f',
    record_sql: 'obfuscated',
  },
  error_collector: {
    enabled: true,
    ignore_status_codes: [404],
  },
};

// apps/api/src/main.ts - FIRST LINE
require('newrelic');

// Rest of imports...
```

---

### 8. Load Testing Suite (k6)

**Estimated Effort:** 3 days

**File Structure:**

```
infra/load-tests/
├── scenarios/
│   ├── auth-flow.js
│   ├── transaction-bulk.js
│   ├── provider-sync.js
│   └── dashboard-load.js
├── config/
│   ├── dev.json
│   ├── staging.json
│   └── prod.json
└── run-tests.sh
```

**Example Test:**

```javascript
// infra/load-tests/scenarios/transaction-bulk.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests < 2s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};

export default function () {
  const BASE_URL = __ENV.API_URL || 'http://localhost:4010/v1';

  // Login
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: 'test@example.com',
      password: 'TestPassword123!',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  const token = loginRes.json('accessToken');

  // Bulk create transactions
  const transactions = Array.from({ length: 100 }, (_, i) => ({
    accountId: 'test-account-id',
    amount: -Math.random() * 1000,
    description: `Transaction ${i}`,
    date: new Date().toISOString(),
    currency: 'MXN',
  }));

  const bulkRes = http.post(`${BASE_URL}/transactions/bulk`, JSON.stringify({ transactions }), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  check(bulkRes, {
    'bulk create < 2s': (r) => r.timings.duration < 2000,
    'bulk create successful': (r) => r.status === 201,
  });

  sleep(1);
}
```

**Run Tests:**

```bash
# Install k6
brew install k6

# Run tests
k6 run infra/load-tests/scenarios/transaction-bulk.js

# With custom config
k6 run --config infra/load-tests/config/staging.json \
  infra/load-tests/scenarios/transaction-bulk.js

# Output to InfluxDB for visualization
k6 run --out influxdb=http://localhost:8086/k6 \
  infra/load-tests/scenarios/transaction-bulk.js
```

---

### 9. GDPR/CCPA Compliance Features

**Estimated Effort:** 3-4 days

**Features to Implement:**

#### 9.1 Data Export API

```typescript
// apps/api/src/modules/users/users.controller.ts
@Post(':id/export')
@UseGuards(JwtAuthGuard)
async exportUserData(@Param('id') userId: string, @CurrentUser() user: User) {
  // Verify user can only export their own data
  if (userId !== user.id) {
    throw new ForbiddenException();
  }

  const data = await this.usersService.exportUserData(userId);

  return {
    user: data.user,
    spaces: data.spaces,
    accounts: data.accounts,
    transactions: data.transactions,
    budgets: data.budgets,
    exportedAt: new Date().toISOString(),
  };
}

// apps/api/src/modules/users/users.service.ts
async exportUserData(userId: string) {
  return {
    user: await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        locale: true,
        timezone: true,
        createdAt: true,
        // Exclude sensitive fields
      },
    }),
    spaces: await this.prisma.space.findMany({
      where: { userSpaces: { some: { userId } } },
      include: { budgets: true },
    }),
    accounts: await this.prisma.account.findMany({
      where: { space: { userSpaces: { some: { userId } } } },
      select: {
        // Only non-sensitive fields
        id: true,
        name: true,
        type: true,
        currency: true,
        balance: true,
        // Exclude encryptedCredentials
      },
    }),
    transactions: await this.prisma.transaction.findMany({
      where: {
        account: {
          space: { userSpaces: { some: { userId } } },
        },
      },
    }),
  };
}
```

#### 9.2 Account Deletion

```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard)
async deleteAccount(@Param('id') userId: string, @CurrentUser() user: User) {
  if (userId !== user.id && !user.isAdmin) {
    throw new ForbiddenException();
  }

  // Log deletion request
  await this.auditService.log({
    userId,
    action: 'account_deletion_requested',
    severity: 'critical',
  });

  // Delete all user data (cascades via Prisma)
  await this.usersService.deleteUser(userId);

  // Send confirmation email
  await this.emailService.sendAccountDeletionConfirmation(user.email);

  return { message: 'Account deleted successfully' };
}

async deleteUser(userId: string) {
  // All related data is deleted via CASCADE in Prisma schema
  await this.prisma.user.delete({
    where: { id: userId },
  });

  // Delete from analytics
  await this.posthogService.capture({
    distinctId: userId,
    event: 'account_deleted',
  });
}
```

#### 9.3 Privacy Policy & Consent

```typescript
// apps/api/prisma/schema.prisma - ADD
model User {
  // ... existing fields

  privacyPolicyAcceptedAt DateTime? @map("privacy_policy_accepted_at")
  privacyPolicyVersion    String?   @map("privacy_policy_version")
  marketingConsent        Boolean   @default(false) @map("marketing_consent")
  dataProcessingConsent   Boolean   @default(false) @map("data_processing_consent")
}

// apps/api/src/modules/users/dto/update-consent.dto.ts
export class UpdateConsentDto {
  @IsBoolean()
  marketingConsent: boolean;

  @IsBoolean()
  dataProcessingConsent: boolean;
}

// API endpoint
@Put('consent')
async updateConsent(@CurrentUser() user: User, @Body() dto: UpdateConsentDto) {
  return this.usersService.updateConsent(user.id, dto);
}
```

#### 9.4 Data Retention Policy

```typescript
// apps/api/src/modules/jobs/processors/data-retention.processor.ts
@Processor('data-retention')
export class DataRetentionProcessor {
  @Process('cleanup-inactive-users')
  async cleanupInactiveUsers() {
    // Delete users inactive for 2+ years (after email warning)
    const twoYearsAgo = subYears(new Date(), 2);

    const inactiveUsers = await this.prisma.user.findMany({
      where: {
        lastLoginAt: { lt: twoYearsAgo },
        isActive: false,
      },
    });

    for (const user of inactiveUsers) {
      // Send final warning email
      await this.emailService.sendInactivityWarning(user.email);

      // Schedule deletion in 30 days if no login
      await this.queue.add(
        'delete-inactive-user',
        {
          userId: user.id,
        },
        {
          delay: 30 * 24 * 60 * 60 * 1000, // 30 days
        }
      );
    }
  }

  @Process('archive-old-transactions')
  async archiveOldTransactions() {
    // Archive transactions >7 years old (financial record keeping requirement)
    const sevenYearsAgo = subYears(new Date(), 7);

    await this.prisma.transaction.updateMany({
      where: {
        date: { lt: sevenYearsAgo },
        archived: false,
      },
      data: {
        archived: true,
      },
    });
  }
}
```

---

### 10. Mobile Offline Mode

**Estimated Effort:** 1 week

**Implementation Strategy:**

**1. AsyncStorage for Offline Data:**

```typescript
// apps/mobile/src/lib/offline-storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  TRANSACTIONS: '@dhanam:transactions',
  ACCOUNTS: '@dhanam:accounts',
  BUDGETS: '@dhanam:budgets',
  PENDING_SYNC: '@dhanam:pending_sync',
};

export class OfflineStorage {
  static async saveTransactions(transactions: Transaction[]) {
    await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  static async getTransactions(): Promise<Transaction[]> {
    const data = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  }

  static async addPendingSync(mutation: PendingMutation) {
    const pending = await this.getPendingSync();
    pending.push(mutation);
    await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify(pending));
  }

  static async getPendingSync(): Promise<PendingMutation[]> {
    const data = await AsyncStorage.getItem(KEYS.PENDING_SYNC);
    return data ? JSON.parse(data) : [];
  }

  static async clearPendingSync() {
    await AsyncStorage.removeItem(KEYS.PENDING_SYNC);
  }
}

interface PendingMutation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'transaction' | 'budget' | 'category';
  data: any;
  timestamp: number;
}
```

**2. Network Detection:**

```typescript
// apps/mobile/src/hooks/useNetworkStatus.ts
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    return () => unsubscribe();
  }, []);

  return {
    isConnected,
    isInternetReachable,
    isOffline: !isConnected || !isInternetReachable,
  };
};
```

**3. Offline Queue:**

```typescript
// apps/mobile/src/lib/offline-queue.ts
export class OfflineQueue {
  private queue: PendingMutation[] = [];
  private isSyncing = false;

  async addMutation(mutation: PendingMutation) {
    this.queue.push(mutation);
    await OfflineStorage.addPendingSync(mutation);
  }

  async syncWhenOnline() {
    if (this.isSyncing) return;

    this.isSyncing = true;
    const pending = await OfflineStorage.getPendingSync();

    try {
      for (const mutation of pending) {
        await this.executeMutation(mutation);
      }

      // Clear queue on success
      await OfflineStorage.clearPendingSync();
      this.queue = [];
    } catch (error) {
      console.error('Sync failed:', error);
      // Keep queue for retry
    } finally {
      this.isSyncing = false;
    }
  }

  private async executeMutation(mutation: PendingMutation) {
    switch (mutation.type) {
      case 'CREATE':
        await api.post(`/${mutation.entity}s`, mutation.data);
        break;
      case 'UPDATE':
        await api.put(`/${mutation.entity}s/${mutation.data.id}`, mutation.data);
        break;
      case 'DELETE':
        await api.delete(`/${mutation.entity}s/${mutation.data.id}`);
        break;
    }
  }
}
```

**4. Usage in Components:**

```typescript
// apps/mobile/src/screens/TransactionCreate.tsx
const TransactionCreate = () => {
  const { isOffline } = useNetworkStatus();
  const offlineQueue = useOfflineQueue();

  const createTransaction = async (data: CreateTransactionDto) => {
    if (isOffline) {
      // Save to local storage
      const transaction = {
        id: uuid(),
        ...data,
        _offline: true,
      };

      // Add to offline queue
      await offlineQueue.addMutation({
        id: uuid(),
        type: 'CREATE',
        entity: 'transaction',
        data: transaction,
        timestamp: Date.now(),
      });

      // Update local state immediately
      dispatch(addTransaction(transaction));

      showToast('Transaction saved offline. Will sync when online.');
    } else {
      // Normal API call
      const result = await api.createTransaction(data);
      dispatch(addTransaction(result));
    }
  };

  return (
    <View>
      {isOffline && (
        <Banner type="warning">
          You're offline. Changes will sync when connected.
        </Banner>
      )}
      {/* Form */}
    </View>
  );
};
```

---

### 11. Security Audit Checklist

**Estimated Effort:** 1-2 weeks (external audit)

**Internal Preparation:**

```markdown
# Security Audit Checklist

## Authentication & Authorization

- [ ] JWT tokens expire in ≤15 minutes
- [ ] Refresh tokens rotate on use
- [ ] Refresh tokens expire in ≤30 days
- [ ] TOTP 2FA implementation verified
- [ ] Backup codes properly hashed
- [ ] Password hashing uses Argon2id with OWASP params
- [ ] Rate limiting on auth endpoints (5 attempts/15min)
- [ ] Account lockout after failed attempts
- [ ] Password reset tokens expire in 1 hour
- [ ] Email verification required before activation

## Data Encryption

- [ ] Provider tokens encrypted with KMS (production)
- [ ] Database credentials encrypted at rest
- [ ] TLS 1.3 enforced for all connections
- [ ] Sensitive headers removed from logs
- [ ] PII data not logged or sent to analytics
- [ ] Database encrypted at rest (RDS encryption)
- [ ] Backups encrypted

## API Security

- [ ] All endpoints require authentication (except public)
- [ ] CORS properly configured
- [ ] Helmet security headers enabled
- [ ] Rate limiting per user (100 req/15min)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] XSS prevention (no eval, no innerHTML)
- [ ] CSRF tokens for state-changing operations

## Provider Integration Security

- [ ] Belvo webhook HMAC verification
- [ ] Plaid webhook signature verification
- [ ] Bitso API key rotation capability
- [ ] Provider credentials never logged
- [ ] OAuth state parameter validation
- [ ] Redirect URI whitelist enforced

## Infrastructure Security

- [ ] Environment variables not committed to git
- [ ] Secrets stored in AWS Secrets Manager
- [ ] IAM roles follow least privilege
- [ ] Security groups restrict access
- [ ] Database not publicly accessible
- [ ] VPC properly configured
- [ ] CloudWatch alerts for suspicious activity
- [ ] WAF rules configured

## Code Security

- [ ] No hardcoded secrets
- [ ] No eval() or similar dynamic code execution
- [ ] Dependencies scanned for vulnerabilities (npm audit)
- [ ] Dependabot enabled
- [ ] Code scanning (CodeQL) enabled
- [ ] Branch protection rules enforced
- [ ] Required code reviews

## Compliance

- [ ] GDPR data export implemented
- [ ] GDPR right to deletion implemented
- [ ] Privacy policy accepted on registration
- [ ] Cookie consent (web app)
- [ ] Data retention policies documented
- [ ] Audit logging for sensitive operations
- [ ] PCI DSS not required (no card storage)

## Testing

- [ ] Security test suite exists
- [ ] Penetration testing completed
- [ ] Vulnerability scan completed
- [ ] Load testing completed
- [ ] Disaster recovery tested
- [ ] Backup restoration tested

## Monitoring

- [ ] Sentry error tracking enabled
- [ ] Failed login attempts monitored
- [ ] Unusual API usage monitored
- [ ] Database slow queries monitored
- [ ] Disk space alerts configured
- [ ] Memory usage alerts configured
```

---

## 🎯 IMPLEMENTATION PRIORITY MATRIX

| Task                  | Priority | Effort | Impact   | Start Week |
| --------------------- | -------- | ------ | -------- | ---------- |
| ✅ Prisma Migrations  | Critical | Low    | High     | Completed  |
| ✅ Sentry Integration | Critical | Low    | High     | Completed  |
| Test Coverage 80%+    | Critical | High   | High     | Week 1-2   |
| Spanish i18n          | High     | Medium | High     | Week 2     |
| PostHog Complete      | High     | Low    | Medium   | Week 3     |
| Cashflow Forecasting  | High     | High   | High     | Week 3-4   |
| Load Testing          | Medium   | Medium | Medium   | Week 4     |
| GDPR Compliance       | High     | Medium | High     | Week 4     |
| APM Integration       | Medium   | Low    | Medium   | Week 4     |
| Mobile Offline        | Medium   | High   | Medium   | Future     |
| Security Audit        | High     | High   | Critical | Week 5-6   |

---

## 📊 SUCCESS METRICS

**Week 1-2 Goals:**

- ✅ Database migrations deployed
- ✅ Sentry capturing production errors
- ⬜ Test coverage >80% on critical paths
- ⬜ Spanish translations complete (200+ keys)

**Week 3-4 Goals:**

- ⬜ PostHog tracking all documented events
- ⬜ Cashflow forecasting API functional
- ⬜ Load tests passing performance thresholds
- ⬜ GDPR compliance features deployed

**Week 5-6 Goals:**

- ⬜ External security audit completed
- ⬜ All critical vulnerabilities resolved
- ⬜ Production monitoring dashboards live
- ⬜ Documentation complete

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying to production:

**Infrastructure:**

- [ ] Database migrations tested on staging
- [ ] Rollback procedure documented and tested
- [ ] Environment variables set in production
- [ ] Secrets rotated (JWT, encryption keys)
- [ ] KMS key created and IAM permissions set
- [ ] Sentry project created and DSN configured
- [ ] PostHog project created and API key set
- [ ] New Relic license key configured
- [ ] CloudWatch alarms configured
- [ ] Backup schedule verified
- [ ] Disaster recovery plan documented

**Code:**

- [ ] All tests passing (unit, integration, E2E)
- [ ] Test coverage >80%
- [ ] No critical vulnerabilities (npm audit)
- [ ] Code reviewed by 2+ team members
- [ ] Changelog updated
- [ ] Version tagged in git

**Documentation:**

- [ ] API documentation updated
- [ ] Deployment guide updated
- [ ] Runbook for incidents created
- [ ] On-call rotation scheduled

**Monitoring:**

- [ ] Health check endpoint working
- [ ] Metrics dashboard created
- [ ] Error alerts configured
- [ ] Performance alerts configured
- [ ] On-call team notified

---

## 📚 RESOURCES

**External Documentation:**

- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Sentry Node.js](https://docs.sentry.io/platforms/node/)
- [PostHog](https://posthog.com/docs)
- [k6 Load Testing](https://k6.io/docs/)
- [New Relic APM](https://docs.newrelic.com/docs/apm/)
- [GDPR Compliance](https://gdpr.eu/)
- [React Native Offline](https://github.com/rgommezz/react-native-offline)

**Internal Documentation:**

- `apps/api/MIGRATIONS_GUIDE.md`
- `docs/SENTRY_SETUP.md`
- `COMPREHENSIVE_AUDIT_REPORT_2025.md`
- `CLAUDE.md`

---

**Last Updated:** 2025-11-17
**Next Review:** Weekly during implementation
