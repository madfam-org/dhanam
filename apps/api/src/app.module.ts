import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      cache: true,
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
