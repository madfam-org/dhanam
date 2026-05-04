import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';
import { SpacesModule } from '../spaces/spaces.module';

import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategorizationRulesController } from './categorization-rules.controller';
import { RulesService } from './rules.service';

// Cycle: JobsModule → CategoriesModule → SpacesModule → BillingModule
// → MonitoringModule → JobsModule. forwardRef defers the SpacesModule
// edge so module-graph construction completes; provider DI still
// resolves once both modules are constructed. Mirrors the pattern in
// billing.module.ts (#414) for the BillingModule → EmailModule edge.
@Module({
  imports: [PrismaModule, forwardRef(() => SpacesModule)],
  controllers: [CategoriesController, CategorizationRulesController],
  providers: [CategoriesService, RulesService],
  exports: [CategoriesService, RulesService],
})
export class CategoriesModule {}
