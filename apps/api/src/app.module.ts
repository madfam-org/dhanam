import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuditModule } from '@core/audit/audit.module';
import { AuthModule } from '@core/auth/auth.module';
import { CoreModule } from '@core/core.module';
import { EventsModule } from '@core/events/events.module';
import { MonitoringModule } from '@core/monitoring/monitoring.module';
import { RateLimitingModule } from '@core/security/rate-limiting.module';
import { AccountsModule } from '@modules/accounts/accounts.module';
import { AdminModule } from '@modules/admin/admin.module';
import { AnalyticsModule } from '@modules/analytics/analytics.module';
import { BillingModule } from '@modules/billing/billing.module';
import { BudgetsModule } from '@modules/budgets/budgets.module';
import { CapitalStackModule } from '@modules/capital-stack/capital-stack.module';
import { CategoriesModule } from '@modules/categories/categories.module';
import { DocumentsModule } from '@modules/documents/documents.module';
import { EmailModule } from '@modules/email/email.module';
import { EstatePlanningModule } from '@modules/estate-planning/estate-planning.module';
import { FxModule } from '@modules/fx/fx.module';
import { FxRatesModule } from '@modules/fx-rates/fx-rates.module';
import { GamingModule } from '@modules/gaming/gaming.module';
import { GoalsModule } from '@modules/goals/goals.module';
import { HouseholdsModule } from '@modules/households/households.module';
import { IntegrationsModule } from '@modules/integrations/integrations.module';
import { JobsModule } from '@modules/jobs/jobs.module';
import { KycModule } from '@modules/kyc/kyc.module';
import { ManualAssetsModule } from '@modules/manual-assets/manual-assets.module';
import { OnboardingModule } from '@modules/onboarding/onboarding.module';
import { PreferencesModule } from '@modules/preferences/preferences.module';
import { ProvidersModule } from '@modules/providers/providers.module';
import { RecurringModule } from '@modules/recurring/recurring.module';
import { ReferralModule } from '@modules/referral/referral.module';
import { SearchModule } from '@modules/search/search.module';
import { SimulationsModule } from '@modules/simulations/simulations.module';
import { SpacesModule } from '@modules/spaces/spaces.module';
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module';
import { TagsModule } from '@modules/tags/tags.module';
import { TransactionExecutionModule } from '@modules/transaction-execution/transaction-execution.module';
import { TransactionsModule } from '@modules/transactions/transactions.module';
import { UsersModule } from '@modules/users/users.module';

import { configuration } from './config/configuration';
import { validationSchema } from './config/validation';

function redisOptionsFromUrl(redisUrl?: string) {
  if (!redisUrl) {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
    };
  }

  const url = new URL(redisUrl);
  const db = url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : undefined;

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number.isFinite(db) ? db : undefined,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      cache: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: redisOptionsFromUrl(config.get<string>('REDIS_URL')),
      }),
    }),
    CoreModule,
    EventsModule,
    AuthModule,
    RateLimitingModule,
    AuditModule,
    UsersModule,
    SpacesModule,
    AccountsModule,
    TransactionsModule,
    BudgetsModule,
    CategoriesModule,
    IntegrationsModule,
    AnalyticsModule,
    JobsModule,
    ProvidersModule,
    FxModule,
    FxRatesModule,
    OnboardingModule,
    PreferencesModule,
    MonitoringModule,
    EmailModule,
    AdminModule,
    BillingModule,
    GamingModule,
    GoalsModule,
    KycModule,
    HouseholdsModule,
    CapitalStackModule,
    EstatePlanningModule,
    SimulationsModule,
    TransactionExecutionModule,
    ManualAssetsModule,
    DocumentsModule,
    RecurringModule,
    ReferralModule,
    SubscriptionsModule,
    SearchModule,
    TagsModule,
  ],
})
export class AppModule {}
