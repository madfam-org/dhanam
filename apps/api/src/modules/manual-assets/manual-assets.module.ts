import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';
import { CollectiblesValuationModule } from '../collectibles-valuation/collectibles-valuation.module';
import { KarafielService } from '../integrations/karafiel.service';
import { ZillowModule } from '../integrations/zillow/zillow.module';
import { SpacesModule } from '../spaces/spaces.module';
import { StorageModule } from '../storage/storage.module';

import { ComplianceIngestController } from './compliance-ingest.controller';
import { DocumentExtractionService } from './document-extraction.service';
import { DocumentService } from './document.service';
import { ManualAssetsController } from './manual-assets.controller';
import { ManualAssetsService } from './manual-assets.service';
import { PEAnalyticsService } from './pe-analytics.service';
import { RealEstateValuationService } from './real-estate-valuation.service';

@Module({
  imports: [
    PrismaModule,
    SpacesModule,
    StorageModule,
    ZillowModule,
    CollectiblesValuationModule,
    HttpModule.register({ timeout: 60_000 }),
  ],
  controllers: [ManualAssetsController, ComplianceIngestController],
  providers: [
    ManualAssetsService,
    PEAnalyticsService,
    DocumentService,
    RealEstateValuationService,
    DocumentExtractionService,
    KarafielService,
  ],
  exports: [ManualAssetsService, PEAnalyticsService, DocumentService, RealEstateValuationService],
})
export class ManualAssetsModule {}
