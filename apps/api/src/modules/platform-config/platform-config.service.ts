import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '@core/audit/audit.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { PlatformConfigScope } from '../../../generated/prisma';

import {
  MADFAM_IMPORT_CONFIG_KEYS,
  MADFAM_IMPORT_KEY_PREFIX,
  jsonConfigToString,
} from './platform-config.keys';

export interface PlatformConfigEntry {
  key: string;
  scope: PlatformConfigScope;
  scopeId: string;
  value: unknown;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface MadfamImportPlatformSettings {
  businessRfc: string | null;
  spaceNameBusiness: string | null;
  spaceNamePartner: string | null;
  spaceNamePersonal: string | null;
  accountSuffixPartner: string | null;
  accountSuffixPersonal: string | null;
}

@Injectable()
export class PlatformConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listPlatform(
    prefix?: string,
    scope: PlatformConfigScope = PlatformConfigScope.platform,
    scopeId = ''
  ): Promise<PlatformConfigEntry[]> {
    const rows = await this.prisma.platformConfig.findMany({
      where: {
        scope,
        scopeId,
        ...(prefix ? { key: { startsWith: prefix } } : {}),
      },
      orderBy: { key: 'asc' },
    });

    return rows.map((row) => ({
      key: row.key,
      scope: row.scope,
      scopeId: row.scopeId,
      value: row.value,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    }));
  }

  async get(
    key: string,
    scope: PlatformConfigScope = PlatformConfigScope.platform,
    scopeId = ''
  ): Promise<PlatformConfigEntry | null> {
    const row = await this.prisma.platformConfig.findUnique({
      where: { key_scope_scopeId: { key, scope, scopeId } },
    });
    if (!row) return null;
    return {
      key: row.key,
      scope: row.scope,
      scopeId: row.scopeId,
      value: row.value,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }

  async upsert(
    key: string,
    value: unknown,
    adminUserId: string,
    scope: PlatformConfigScope = PlatformConfigScope.platform,
    scopeId = ''
  ): Promise<PlatformConfigEntry> {
    const row = await this.prisma.platformConfig.upsert({
      where: { key_scope_scopeId: { key, scope, scopeId } },
      create: {
        key,
        scope,
        scopeId,
        value: value as object,
        updatedBy: adminUserId,
      },
      update: {
        value: value as object,
        updatedBy: adminUserId,
      },
    });

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.upsert_platform_config',
      resource: 'PlatformConfig',
      resourceId: key,
      metadata: { scope, scopeId },
      severity: 'high',
    });

    return {
      key: row.key,
      scope: row.scope,
      scopeId: row.scopeId,
      value: row.value,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }

  async getMadfamImportSettings(): Promise<MadfamImportPlatformSettings> {
    const rows = await this.listPlatform(MADFAM_IMPORT_KEY_PREFIX);
    const byKey = new Map(rows.map((r) => [r.key, jsonConfigToString(r.value)]));

    return {
      businessRfc: byKey.get(MADFAM_IMPORT_CONFIG_KEYS.businessRfc) ?? null,
      spaceNameBusiness: byKey.get(MADFAM_IMPORT_CONFIG_KEYS.spaceNameBusiness) ?? null,
      spaceNamePartner: byKey.get(MADFAM_IMPORT_CONFIG_KEYS.spaceNamePartner) ?? null,
      spaceNamePersonal: byKey.get(MADFAM_IMPORT_CONFIG_KEYS.spaceNamePersonal) ?? null,
      accountSuffixPartner: byKey.get(MADFAM_IMPORT_CONFIG_KEYS.accountSuffixPartner) ?? null,
      accountSuffixPersonal: byKey.get(MADFAM_IMPORT_CONFIG_KEYS.accountSuffixPersonal) ?? null,
    };
  }

  async updateMadfamImportSettings(
    settings: Partial<MadfamImportPlatformSettings>,
    adminUserId: string
  ): Promise<MadfamImportPlatformSettings> {
    const entries: Array<[string, string | null | undefined]> = [
      [MADFAM_IMPORT_CONFIG_KEYS.businessRfc, settings.businessRfc],
      [MADFAM_IMPORT_CONFIG_KEYS.spaceNameBusiness, settings.spaceNameBusiness],
      [MADFAM_IMPORT_CONFIG_KEYS.spaceNamePartner, settings.spaceNamePartner],
      [MADFAM_IMPORT_CONFIG_KEYS.spaceNamePersonal, settings.spaceNamePersonal],
      [MADFAM_IMPORT_CONFIG_KEYS.accountSuffixPartner, settings.accountSuffixPartner],
      [MADFAM_IMPORT_CONFIG_KEYS.accountSuffixPersonal, settings.accountSuffixPersonal],
    ];

    for (const [key, val] of entries) {
      if (val === undefined) continue;
      if (val === null || val.trim() === '') {
        const existing = await this.get(key);
        if (existing) {
          await this.prisma.platformConfig.delete({
            where: { key_scope_scopeId: { key, scope: PlatformConfigScope.platform, scopeId: '' } },
          });
        }
        continue;
      }
      await this.upsert(key, val.trim(), adminUserId);
    }

    return this.getMadfamImportSettings();
  }

  async requireKey(
    key: string,
    scope: PlatformConfigScope = PlatformConfigScope.platform,
    scopeId = ''
  ): Promise<PlatformConfigEntry> {
    const entry = await this.get(key, scope, scopeId);
    if (!entry) {
      throw new NotFoundException(`Platform config key not found: ${key}`);
    }
    return entry;
  }

  async deleteKey(
    key: string,
    adminUserId: string,
    scope: PlatformConfigScope = PlatformConfigScope.platform,
    scopeId = ''
  ): Promise<void> {
    const existing = await this.get(key, scope, scopeId);
    if (!existing) {
      return;
    }

    await this.prisma.platformConfig.delete({
      where: { key_scope_scopeId: { key, scope, scopeId } },
    });

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.delete_platform_config',
      resource: 'PlatformConfig',
      resourceId: key,
      metadata: { scope, scopeId },
      severity: 'high',
    });
  }
}
