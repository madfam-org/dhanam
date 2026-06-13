import { readFileSync } from 'fs';
import { join } from 'path';

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';

import { BILLING_ROUTE_FEE_SCHEDULE_KEY } from '../../platform-config/platform-config.keys';
import { PlatformConfigService } from '../../platform-config/platform-config.service';
import {
  type FeeScheduleEntry,
  type FeeScheduleFile,
  parseFeeScheduleEntries,
  validateFeeScheduleEntries,
} from '../config/payment-route-fee-schedule';

@Injectable()
export class PaymentRouteFeeScheduleService implements OnModuleInit {
  private readonly logger = new Logger(PaymentRouteFeeScheduleService.name);
  private scheduleVersion = 'bundled';
  private scheduleSource: 'file' | 'platform_config' = 'file';
  private entries: FeeScheduleEntry[] = [];

  constructor(@Optional() private platformConfig?: PlatformConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  getSchedule(): {
    version: string;
    source: 'file' | 'platform_config';
    entries: FeeScheduleEntry[];
  } {
    return {
      version: this.scheduleVersion,
      source: this.scheduleSource,
      entries: this.entries,
    };
  }

  getEntries(): FeeScheduleEntry[] {
    return this.entries;
  }

  async reload(): Promise<void> {
    const override = await this.loadPlatformOverride();
    if (override) {
      this.entries = override.entries;
      this.scheduleVersion = override.version;
      this.scheduleSource = 'platform_config';
      this.logger.log(
        `Loaded payment route fee schedule from platform_config (${this.entries.length} entries, v${this.scheduleVersion})`
      );
      return;
    }

    const fileSchedule = this.loadFileSchedule();
    this.entries = fileSchedule.entries;
    this.scheduleVersion = fileSchedule.version;
    this.scheduleSource = 'file';
    this.logger.log(
      `Loaded payment route fee schedule from file (${this.entries.length} entries, v${this.scheduleVersion})`
    );
  }

  async upsertPlatformOverride(payload: {
    version: string;
    entries: FeeScheduleEntry[];
    updatedBy: string;
  }): Promise<{ version: string; entryCount: number }> {
    if (!this.platformConfig) {
      throw new Error('PlatformConfigService is not available');
    }

    validateFeeScheduleEntries(payload.entries);

    await this.platformConfig.upsert(
      BILLING_ROUTE_FEE_SCHEDULE_KEY,
      {
        version: payload.version,
        entries: payload.entries,
        updatedAt: new Date().toISOString(),
      },
      payload.updatedBy
    );

    await this.reload();

    return {
      version: this.scheduleVersion,
      entryCount: this.entries.length,
    };
  }

  async clearPlatformOverride(updatedBy: string): Promise<void> {
    if (!this.platformConfig) {
      throw new Error('PlatformConfigService is not available');
    }

    await this.platformConfig.deleteKey(BILLING_ROUTE_FEE_SCHEDULE_KEY, updatedBy);
    await this.reload();
  }

  private loadFileSchedule(): FeeScheduleFile {
    const filePath = join(__dirname, '..', 'config', 'payment-route-fee-schedule.bundled.json');
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as FeeScheduleFile;
    validateFeeScheduleEntries(parsed.entries);
    return parsed;
  }

  private async loadPlatformOverride(): Promise<FeeScheduleFile | null> {
    if (!this.platformConfig) {
      return null;
    }

    const row = await this.platformConfig.get(BILLING_ROUTE_FEE_SCHEDULE_KEY);
    if (!row?.value || typeof row.value !== 'object') {
      return null;
    }

    const payload = row.value as { version?: string; entries?: unknown };
    if (!Array.isArray(payload.entries)) {
      return null;
    }

    const entries = parseFeeScheduleEntries(payload.entries);
    validateFeeScheduleEntries(entries);

    return {
      version: payload.version ?? 'platform_override',
      source: 'platform_config override',
      entries,
    };
  }
}
