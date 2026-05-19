import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Currency } from '@db';

import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';

import { UpdatePreferencesDto, BulkPreferencesUpdateDto } from './dto';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  let service: PreferencesService;
  let prisma: PrismaService;
  let auditService: AuditService;

  const mockUserId = 'test-user-123';
  const mockPreferencesId = 'pref-123';

  const mockUserPreferences = {
    id: mockPreferencesId,
    userId: mockUserId,
    emailNotifications: true,
    transactionAlerts: true,
    budgetAlerts: true,
    weeklyReports: true,
    monthlyReports: true,
    securityAlerts: true,
    promotionalEmails: false,
    pushNotifications: true,
    transactionPush: true,
    budgetPush: true,
    securityPush: true,
    dataSharing: false,
    analyticsTracking: true,
    personalizedAds: false,
    dashboardLayout: 'standard',
    chartType: 'line',
    themeMode: 'light',
    compactView: false,
    showBalances: true,
    defaultCurrency: Currency.MXN,
    hideSensitiveData: false,
    autoCategorizeTxns: true,
    includeWeekends: true,
    esgScoreVisibility: true,
    sustainabilityAlerts: false,
    impactReporting: false,
    autoBackup: false,
    backupFrequency: null,
    exportFormat: 'csv',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  const mockPrismaService = {
    userPreferences: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
    logEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferencesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PreferencesService>(PreferencesService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getUserPreferences', () => {
    it('should return existing user preferences', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(mockUserPreferences);

      const result = await service.getUserPreferences(mockUserId);

      expect(result).toMatchObject({
        id: mockPreferencesId,
        userId: mockUserId,
        emailNotifications: true,
        defaultCurrency: Currency.MXN,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });
      expect(mockPrismaService.userPreferences.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });

    it('should create default preferences if none exist', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUserId,
        locale: 'es',
        timezone: 'America/Mexico_City',
      });
      mockPrismaService.userPreferences.create.mockResolvedValue(mockUserPreferences);

      const result = await service.getUserPreferences(mockUserId);

      expect(mockPrismaService.userPreferences.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          defaultCurrency: Currency.MXN,
        },
      });
      expect(result.defaultCurrency).toBe(Currency.MXN);
    });

    it('should use USD as default currency for non-Spanish locale', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUserId,
        locale: 'en',
        timezone: 'America/New_York',
      });
      mockPrismaService.userPreferences.create.mockResolvedValue({
        ...mockUserPreferences,
        defaultCurrency: Currency.USD,
      });

      await service.getUserPreferences(mockUserId);

      expect(mockPrismaService.userPreferences.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          defaultCurrency: Currency.USD,
        },
      });
    });

    it('should throw NotFoundException when user not found during preference creation', async () => {
      // When preferences don't exist and user also doesn't exist
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserPreferences(mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserPreferences', () => {
    const updateDto: UpdatePreferencesDto = {
      emailNotifications: false,
      weeklyReports: false,
      themeMode: 'dark',
      defaultCurrency: Currency.USD,
    };

    it('should update preferences successfully', async () => {
      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(mockUserPreferences) // For ensurePreferencesExist
        .mockResolvedValueOnce(mockUserPreferences); // For getting previous preferences

      const updatedPreferences = {
        ...mockUserPreferences,
        ...updateDto,
        updatedAt: new Date(),
      };
      mockPrismaService.userPreferences.update.mockResolvedValue(updatedPreferences);

      const result = await service.updateUserPreferences(mockUserId, updateDto);

      expect(mockPrismaService.userPreferences.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          ...updateDto,
          updatedAt: expect.any(Date),
        }),
      });
      expect(result.emailNotifications).toBe(false);
      expect(result.themeMode).toBe('dark');
    });

    it('should log changes when preferences are updated', async () => {
      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(mockUserPreferences)
        .mockResolvedValueOnce(mockUserPreferences);

      const updatedPreferences = {
        ...mockUserPreferences,
        emailNotifications: false,
        updatedAt: new Date(),
      };
      mockPrismaService.userPreferences.update.mockResolvedValue(updatedPreferences);

      await service.updateUserPreferences(mockUserId, { emailNotifications: false });

      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        action: 'preferences_updated',
        resource: 'user',
        resourceId: mockUserId,
        userId: mockUserId,
        metadata: {
          changes: {
            emailNotifications: { from: true, to: false },
          },
          updatedFields: ['emailNotifications'],
        },
      });
    });

    it('should create preferences if they do not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUserId,
        locale: 'en',
        timezone: 'UTC',
      });

      mockPrismaService.userPreferences.create.mockResolvedValue(mockUserPreferences);

      // Mock sequence:
      // 1. ensurePreferencesExist calls findUnique → null (triggers creation)
      // 2. updateUserPreferences calls findUnique for previousPreferences → mockUserPreferences (after creation)
      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(null) // For ensurePreferencesExist
        .mockResolvedValueOnce(mockUserPreferences); // For previousPreferences (after creation)

      mockPrismaService.userPreferences.update.mockResolvedValue({
        ...mockUserPreferences,
        ...updateDto,
      });

      await service.updateUserPreferences(mockUserId, updateDto);

      expect(mockPrismaService.userPreferences.create).toHaveBeenCalled();
    });

    it('should not log audit if no changes were made', async () => {
      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(mockUserPreferences)
        .mockResolvedValueOnce(mockUserPreferences);

      mockPrismaService.userPreferences.update.mockResolvedValue(mockUserPreferences);

      await service.updateUserPreferences(mockUserId, { emailNotifications: true });

      expect(mockAuditService.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpdatePreferences', () => {
    const bulkUpdateDto: BulkPreferencesUpdateDto = {
      notifications: {
        emailNotifications: false,
        transactionAlerts: false,
      },
      display: {
        themeMode: 'dark',
        compactView: true,
      },
      financial: {
        defaultCurrency: Currency.USD,
      },
    };

    it('should bulk update preferences across categories', async () => {
      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(mockUserPreferences)
        .mockResolvedValueOnce(mockUserPreferences);

      const updatedPreferences = {
        ...mockUserPreferences,
        emailNotifications: false,
        transactionAlerts: false,
        themeMode: 'dark',
        compactView: true,
        defaultCurrency: Currency.USD,
        updatedAt: new Date(),
      };
      mockPrismaService.userPreferences.update.mockResolvedValue(updatedPreferences);

      const result = await service.bulkUpdatePreferences(mockUserId, bulkUpdateDto);

      expect(mockPrismaService.userPreferences.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          emailNotifications: false,
          transactionAlerts: false,
          themeMode: 'dark',
          compactView: true,
          defaultCurrency: Currency.USD,
          updatedAt: expect.any(Date),
        }),
      });
      expect(result.emailNotifications).toBe(false);
      expect(result.themeMode).toBe('dark');
    });

    it('should log bulk update with category information', async () => {
      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(mockUserPreferences)
        .mockResolvedValueOnce(mockUserPreferences);

      mockPrismaService.userPreferences.update.mockResolvedValue({
        ...mockUserPreferences,
        ...bulkUpdateDto,
      });

      await service.bulkUpdatePreferences(mockUserId, bulkUpdateDto);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        action: 'preferences_bulk_updated',
        resource: 'user',
        resourceId: mockUserId,
        userId: mockUserId,
        metadata: {
          categories: ['notifications', 'display', 'financial'],
          totalChanges: 5,
          changes: expect.any(Object),
        },
      });
    });

    it('should handle empty bulk update gracefully', async () => {
      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(mockUserPreferences)
        .mockResolvedValueOnce(mockUserPreferences);

      mockPrismaService.userPreferences.update.mockResolvedValue(mockUserPreferences);

      const result = await service.bulkUpdatePreferences(mockUserId, {});

      expect(mockPrismaService.userPreferences.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toBeTruthy();
    });

    it('should handle privacy settings in bulk update', async () => {
      const bulkUpdateWithPrivacy: BulkPreferencesUpdateDto = {
        privacy: {
          dataSharing: true,
          analyticsTracking: false,
          personalizedAds: true,
        },
      };

      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(mockUserPreferences)
        .mockResolvedValueOnce(mockUserPreferences);

      const updatedPreferences = {
        ...mockUserPreferences,
        dataSharing: true,
        analyticsTracking: false,
        personalizedAds: true,
        updatedAt: new Date(),
      };
      mockPrismaService.userPreferences.update.mockResolvedValue(updatedPreferences);

      const result = await service.bulkUpdatePreferences(mockUserId, bulkUpdateWithPrivacy);

      expect(mockPrismaService.userPreferences.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          dataSharing: true,
          analyticsTracking: false,
          personalizedAds: true,
        }),
      });
      expect(result.dataSharing).toBe(true);
    });

    it('should handle esg settings in bulk update', async () => {
      const bulkUpdateWithEsg: BulkPreferencesUpdateDto = {
        esg: {
          esgScoreVisibility: false,
          sustainabilityAlerts: true,
          impactReporting: true,
        },
      };

      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(mockUserPreferences)
        .mockResolvedValueOnce(mockUserPreferences);

      const updatedPreferences = {
        ...mockUserPreferences,
        esgScoreVisibility: false,
        sustainabilityAlerts: true,
        impactReporting: true,
        updatedAt: new Date(),
      };
      mockPrismaService.userPreferences.update.mockResolvedValue(updatedPreferences);

      const result = await service.bulkUpdatePreferences(mockUserId, bulkUpdateWithEsg);

      expect(mockPrismaService.userPreferences.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          esgScoreVisibility: false,
          sustainabilityAlerts: true,
          impactReporting: true,
        }),
      });
      expect(result.esgScoreVisibility).toBe(false);
    });

    it('should handle backup settings in bulk update', async () => {
      const bulkUpdateWithBackup: BulkPreferencesUpdateDto = {
        backup: {
          autoBackup: true,
          backupFrequency: 'weekly',
          exportFormat: 'json',
        },
      };

      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(mockUserPreferences)
        .mockResolvedValueOnce(mockUserPreferences);

      const updatedPreferences = {
        ...mockUserPreferences,
        autoBackup: true,
        backupFrequency: 'weekly',
        exportFormat: 'json',
        updatedAt: new Date(),
      };
      mockPrismaService.userPreferences.update.mockResolvedValue(updatedPreferences);

      const result = await service.bulkUpdatePreferences(mockUserId, bulkUpdateWithBackup);

      expect(mockPrismaService.userPreferences.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          autoBackup: true,
          backupFrequency: 'weekly',
          exportFormat: 'json',
        }),
      });
      expect(result.autoBackup).toBe(true);
    });
  });

  describe('resetPreferences', () => {
    it('should reset preferences to defaults', async () => {
      const mockUser = {
        id: mockUserId,
        locale: 'es',
        timezone: 'America/Mexico_City',
        preferences: mockUserPreferences,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.userPreferences.delete.mockResolvedValue(mockUserPreferences);
      mockPrismaService.userPreferences.create.mockResolvedValue({
        ...mockUserPreferences,
        // Reset to defaults
        emailNotifications: true,
        promotionalEmails: false,
        themeMode: 'light',
      });

      const result = await service.resetPreferences(mockUserId);

      expect(mockPrismaService.userPreferences.delete).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(mockPrismaService.userPreferences.create).toHaveBeenCalled();
      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        action: 'preferences_reset',
        resource: 'user',
        resourceId: mockUserId,
        userId: mockUserId,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPreferences(mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should handle case when user has no preferences to delete', async () => {
      const mockUser = {
        id: mockUserId,
        locale: 'en',
        timezone: 'UTC',
        preferences: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.userPreferences.create.mockResolvedValue(mockUserPreferences);

      const result = await service.resetPreferences(mockUserId);

      expect(mockPrismaService.userPreferences.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.userPreferences.create).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });
  });

  describe('getPreferencesSummary', () => {
    it('should return preferences summary with customization count', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(mockUserPreferences);

      const result = await service.getPreferencesSummary(mockUserId);

      expect(result).toEqual({
        totalSettings: expect.any(Number),
        categories: {
          notifications: 11,
          privacy: 3,
          display: 5,
          financial: 4,
          esg: 3,
          backup: 3,
        },
        lastUpdated: '2024-01-02T00:00:00.000Z',
        customizations: expect.any(Number),
      });
    });

    it('should return empty summary if preferences do not exist', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null);

      const result = await service.getPreferencesSummary(mockUserId);

      expect(result).toEqual({
        totalSettings: 0,
        categories: {},
        lastUpdated: null,
        customizations: 0,
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrismaService.userPreferences.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.getUserPreferences(mockUserId)).rejects.toThrow('Database error');
    });

    it('should handle null values in preferences correctly', async () => {
      const preferencesWithNulls = {
        ...mockUserPreferences,
        backupFrequency: null,
      };
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(preferencesWithNulls);

      const result = await service.getUserPreferences(mockUserId);

      expect(result.backupFrequency).toBeNull();
    });

    it('should properly calculate changes when updating from null values', async () => {
      const preferencesWithNulls = {
        ...mockUserPreferences,
        backupFrequency: null,
      };

      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(preferencesWithNulls)
        .mockResolvedValueOnce(preferencesWithNulls);

      mockPrismaService.userPreferences.update.mockResolvedValue({
        ...preferencesWithNulls,
        backupFrequency: 'weekly',
      });

      await service.updateUserPreferences(mockUserId, { backupFrequency: 'weekly' });

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            changes: {
              backupFrequency: { from: null, to: 'weekly' },
            },
          }),
        })
      );
    });
  });

  describe('private methods', () => {
    it('should correctly count customizations', async () => {
      // Test with preferences that differ from defaults
      const customizedPreferences = {
        ...mockUserPreferences,
        emailNotifications: false, // Default is true
        themeMode: 'dark', // Default is light
        defaultCurrency: Currency.USD, // Default for es locale is MXN
      };

      mockPrismaService.userPreferences.findUnique.mockResolvedValue(customizedPreferences);

      const result = await service.getPreferencesSummary(mockUserId);

      expect(result.customizations).toBeGreaterThan(0);
    });
  });
});
