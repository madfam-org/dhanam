import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { LoggerService } from '../../../core/logger/logger.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BelvoService } from '../../providers/belvo/belvo.service';
import { BitsoService } from '../../providers/bitso/bitso.service';
import { PlaidService } from '../../providers/plaid/plaid.service';
import { AccountsService } from '../accounts.service';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<LoggerService>;

  const mockSpace = {
    id: 'space-123',
    name: 'Personal Space',
    type: 'personal',
    currency: 'MXN',
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockAccount = {
    id: 'account-123',
    spaceId: 'space-123',
    name: 'Checking Account',
    type: 'checking',
    subtype: 'personal_checking',
    currency: 'MXN',
    balance: 5000.0,
    provider: 'manual',
    ownership: 'individual',
    ownerId: 'user-123',
    encryptedCredentials: 'encrypted_data',
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSharingPermission = {
    id: 'permission-123',
    accountId: 'account-123',
    sharedWithId: 'user-456',
    canView: true,
    canEdit: false,
    canDelete: false,
    expiresAt: null,
    createdAt: new Date(),
    sharedWith: {
      id: 'user-456',
      name: 'Shared User',
      email: 'shared@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: PrismaService,
          useValue: {
            account: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            accountSharingPermission: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            providerConnection: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
        {
          provide: PlaidService,
          useValue: {
            createLink: jest.fn(),
            createLinkToken: jest.fn(),
            exchangePublicToken: jest.fn(),
            fetchTransactionsByDateRange: jest.fn(),
            getAccounts: jest.fn(),
            getTransactions: jest.fn(),
            syncTransactions: jest.fn(),
          },
        },
        {
          provide: BitsoService,
          useValue: {
            connectAccount: jest.fn(),
            fetchBalances: jest.fn(),
            getAccounts: jest.fn(),
            getBalances: jest.fn(),
            getTransactions: jest.fn(),
          },
        },
        {
          provide: BelvoService,
          useValue: {
            syncTransactions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    logger = module.get(LoggerService) as jest.Mocked<LoggerService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listAccounts', () => {
    it('should list all accounts for a space', async () => {
      const accounts = [mockAccount, { ...mockAccount, id: 'account-456', name: 'Savings' }];
      prisma.account.findMany.mockResolvedValue(accounts as any);

      const result = await service.listAccounts('space-123');

      expect(result).toHaveLength(2);
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter accounts by type', async () => {
      const accounts = [mockAccount];
      prisma.account.findMany.mockResolvedValue(accounts as any);

      const result = await service.listAccounts('space-123', 'checking');

      expect(result).toHaveLength(1);
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-123', type: 'checking' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should sanitize accounts by removing encryptedCredentials', async () => {
      prisma.account.findMany.mockResolvedValue([mockAccount] as any);

      const result = await service.listAccounts('space-123');

      expect(result[0]).not.toHaveProperty('encryptedCredentials');
      expect(result[0].balance).toBe(5000.0);
    });
  });

  describe('createAccount', () => {
    it('should create a manual account', async () => {
      const dto = {
        name: 'New Account',
        type: 'savings' as const,
        subtype: 'personal_savings',
        currency: 'MXN',
        balance: 1000,
      };

      prisma.account.create.mockResolvedValue({
        ...mockAccount,
        ...dto,
        id: 'new-account-123',
        provider: 'manual',
      } as any);

      const result = await service.createAccount('space-123', dto);

      expect(result.name).toBe('New Account');
      expect(result.provider).toBe('manual');
      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          spaceId: 'space-123',
          name: dto.name,
          type: dto.type,
          subtype: dto.subtype,
          currency: dto.currency,
          balance: dto.balance,
          provider: 'manual',
        },
      });
      expect(logger.log).toHaveBeenCalled();
    });
  });

  describe('connectAccount', () => {
    it('should throw error for invalid provider', async () => {
      const dto = {
        provider: 'invalid_provider' as any,
        connectionToken: 'token123',
      };

      await expect(service.connectAccount('space-123', 'user-123', dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should redirect Belvo connections to proper endpoint', async () => {
      const dto = {
        provider: 'belvo' as const,
        connectionToken: 'token123',
      };

      await expect(service.connectAccount('space-123', 'user-123', dto)).rejects.toThrow(
        'Belvo connections should be initiated through /providers/belvo/link endpoint'
      );
    });

    it('should require linkToken for Plaid connections', async () => {
      const dto = {
        provider: 'plaid' as const,
        connectionToken: 'token123',
      };

      await expect(service.connectAccount('space-123', 'user-123', dto)).rejects.toThrow(
        'Plaid connections require a linkToken'
      );
    });

    it('should require credentials for Bitso connections', async () => {
      const dto = {
        provider: 'bitso' as const,
        connectionToken: 'token123',
      };

      await expect(service.connectAccount('space-123', 'user-123', dto)).rejects.toThrow(
        'Bitso connections require apiKey and apiSecret in credentials'
      );
    });
  });

  describe('getAccount', () => {
    it('should return an account by id', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);

      const result = await service.getAccount('space-123', 'account-123');

      expect(result.id).toBe('account-123');
      expect(result).not.toHaveProperty('encryptedCredentials');
    });

    it('should throw NotFoundException if account not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.getAccount('space-123', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateAccount', () => {
    it('should update a manual account', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.account.update.mockResolvedValue({
        ...mockAccount,
        name: 'Updated Name',
        balance: 6000,
      } as any);

      const result = await service.updateAccount('space-123', 'account-123', {
        name: 'Updated Name',
        balance: 6000,
      });

      expect(result.name).toBe('Updated Name');
      expect(result.balance).toBe(6000);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAccount('space-123', 'nonexistent', { name: 'Updated' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when updating balance on connected account', async () => {
      const connectedAccount = { ...mockAccount, provider: 'belvo' };
      prisma.account.findFirst.mockResolvedValue(connectedAccount as any);

      await expect(
        service.updateAccount('space-123', 'account-123', { balance: 6000 })
      ).rejects.toThrow('Cannot manually update balance for connected accounts');
    });
  });

  describe('deleteAccount', () => {
    it('should delete an account', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.account.delete.mockResolvedValue(mockAccount as any);

      await service.deleteAccount('space-123', 'account-123');

      expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: 'account-123' } });
      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.deleteAccount('space-123', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('syncAccount', () => {
    it('should sync a connected Belvo account', async () => {
      const connectedAccount = {
        ...mockAccount,
        provider: 'belvo',
        metadata: { linkId: 'belvo-link-123' },
      };
      prisma.account.findFirst.mockResolvedValue(connectedAccount as any);
      prisma.account.update.mockResolvedValue({
        ...connectedAccount,
        lastSyncedAt: new Date(),
      } as any);

      const result = await service.syncAccount('space-123', 'account-123');

      expect(result.status).toBe('completed');
      expect(result.jobId).toBeDefined();
      expect(prisma.account.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.syncAccount('space-123', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw error when syncing manual account', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);

      await expect(service.syncAccount('space-123', 'account-123')).rejects.toThrow(
        'Cannot sync manual accounts'
      );
    });
  });

  describe('updateOwnership', () => {
    it('should update ownership to individual with ownerId', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.account.update.mockResolvedValue({
        ...mockAccount,
        ownership: 'individual',
        ownerId: 'user-456',
      } as any);

      const result = await service.updateOwnership('space-123', 'account-123', 'user-123', {
        ownership: 'individual',
        ownerId: 'user-456',
      });

      expect(result.ownership).toBe('individual');
      expect(logger.log).toHaveBeenCalled();
    });

    it('should update ownership to joint without ownerId', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.account.update.mockResolvedValue({
        ...mockAccount,
        ownership: 'joint',
        ownerId: null,
      } as any);

      const result = await service.updateOwnership('space-123', 'account-123', 'user-123', {
        ownership: 'joint',
      });

      expect(result.ownership).toBe('joint');
    });

    it('should throw NotFoundException if account not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.updateOwnership('space-123', 'nonexistent', 'user-123', { ownership: 'joint' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error for individual ownership without ownerId', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);

      await expect(
        service.updateOwnership('space-123', 'account-123', 'user-123', { ownership: 'individual' })
      ).rejects.toThrow('Individual accounts require an ownerId');
    });

    it('should throw error for joint ownership with ownerId', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);

      await expect(
        service.updateOwnership('space-123', 'account-123', 'user-123', {
          ownership: 'joint',
          ownerId: 'user-456',
        })
      ).rejects.toThrow('Joint accounts should not have an ownerId');
    });
  });

  describe('getAccountsByOwnership', () => {
    it('should get accounts owned by current user (yours)', async () => {
      prisma.account.findMany.mockResolvedValue([mockAccount] as any);

      const result = await service.getAccountsByOwnership('space-123', 'user-123', 'yours');

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            spaceId: 'space-123',
            ownership: 'individual',
            ownerId: 'user-123',
          }),
        })
      );
      expect(result).toHaveLength(1);
    });

    it('should get accounts owned by others (mine)', async () => {
      const otherAccount = { ...mockAccount, ownerId: 'user-456' };
      prisma.account.findMany.mockResolvedValue([otherAccount] as any);

      const result = await service.getAccountsByOwnership('space-123', 'user-123', 'mine');

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            spaceId: 'space-123',
            ownership: 'individual',
            NOT: { ownerId: 'user-123' },
          }),
        })
      );
      expect(result).toHaveLength(1);
    });

    it('should get joint accounts (ours)', async () => {
      const jointAccount = { ...mockAccount, ownership: 'joint', ownerId: null };
      prisma.account.findMany.mockResolvedValue([jointAccount] as any);

      const result = await service.getAccountsByOwnership('space-123', 'user-123', 'ours');

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            spaceId: 'space-123',
            ownership: 'joint',
          }),
        })
      );
      expect(result).toHaveLength(1);
    });

    it('should throw error for invalid filter', async () => {
      await expect(
        service.getAccountsByOwnership('space-123', 'user-123', 'invalid' as any)
      ).rejects.toThrow('Invalid ownership filter');
    });
  });

  describe('getNetWorthByOwnership', () => {
    it('should calculate net worth by ownership category', async () => {
      prisma.account.findMany
        .mockResolvedValueOnce([{ balance: 5000 }, { balance: 3000 }] as any) // yours
        .mockResolvedValueOnce([{ balance: 2000 }] as any) // mine
        .mockResolvedValueOnce([{ balance: 10000 }] as any); // ours

      const result = await service.getNetWorthByOwnership('space-123', 'user-123');

      expect(result.yours).toBe(8000);
      expect(result.mine).toBe(2000);
      expect(result.ours).toBe(10000);
      expect(result.total).toBe(20000);
    });
  });

  describe('shareAccount', () => {
    it('should share an account with another user', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.accountSharingPermission.findUnique.mockResolvedValue(null);
      prisma.accountSharingPermission.create.mockResolvedValue(mockSharingPermission as any);

      const result = await service.shareAccount('space-123', 'account-123', 'user-123', {
        sharedWithId: 'user-456',
        canView: true,
        canEdit: false,
        canDelete: false,
      });

      expect(result.sharedWithId).toBe('user-456');
      expect(result.canView).toBe(true);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.shareAccount('space-123', 'nonexistent', 'user-123', {
          sharedWithId: 'user-456',
          canView: true,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner', async () => {
      const accountWithDifferentOwner = { ...mockAccount, ownerId: 'user-789' };
      prisma.account.findFirst.mockResolvedValue(accountWithDifferentOwner as any);

      await expect(
        service.shareAccount('space-123', 'account-123', 'user-123', {
          sharedWithId: 'user-456',
          canView: true,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw error if already shared', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.accountSharingPermission.findUnique.mockResolvedValue(mockSharingPermission as any);

      await expect(
        service.shareAccount('space-123', 'account-123', 'user-123', {
          sharedWithId: 'user-456',
          canView: true,
        })
      ).rejects.toThrow('Account already shared with this user');
    });
  });

  describe('updateSharingPermission', () => {
    it('should update sharing permissions', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.accountSharingPermission.update.mockResolvedValue({
        ...mockSharingPermission,
        canEdit: true,
      } as any);

      const result = await service.updateSharingPermission(
        'space-123',
        'account-123',
        'permission-123',
        'user-123',
        { canEdit: true }
      );

      expect(result.canEdit).toBe(true);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSharingPermission('space-123', 'nonexistent', 'permission-123', 'user-123', {
          canEdit: true,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner', async () => {
      const accountWithDifferentOwner = { ...mockAccount, ownerId: 'user-789' };
      prisma.account.findFirst.mockResolvedValue(accountWithDifferentOwner as any);

      await expect(
        service.updateSharingPermission('space-123', 'account-123', 'permission-123', 'user-123', {
          canEdit: true,
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeSharingPermission', () => {
    it('should revoke sharing permission', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.accountSharingPermission.delete.mockResolvedValue(mockSharingPermission as any);

      await service.revokeSharingPermission(
        'space-123',
        'account-123',
        'permission-123',
        'user-123'
      );

      expect(prisma.accountSharingPermission.delete).toHaveBeenCalledWith({
        where: { id: 'permission-123' },
      });
      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeSharingPermission('space-123', 'nonexistent', 'permission-123', 'user-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner', async () => {
      const accountWithDifferentOwner = { ...mockAccount, ownerId: 'user-789' };
      prisma.account.findFirst.mockResolvedValue(accountWithDifferentOwner as any);

      await expect(
        service.revokeSharingPermission('space-123', 'account-123', 'permission-123', 'user-123')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAccountSharingPermissions', () => {
    it('should return all sharing permissions for an account', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.accountSharingPermission.findMany.mockResolvedValue([mockSharingPermission] as any);

      const result = await service.getAccountSharingPermissions('space-123', 'account-123');

      expect(result).toHaveLength(1);
      expect(result[0].sharedWith.email).toBe('shared@example.com');
    });

    it('should throw NotFoundException if account not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.getAccountSharingPermissions('space-123', 'nonexistent')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSharedAccounts', () => {
    it('should return accounts shared with the user', async () => {
      const sharedPermission = {
        ...mockSharingPermission,
        account: {
          ...mockAccount,
          owner: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
        },
      };
      prisma.accountSharingPermission.findMany.mockResolvedValue([sharedPermission] as any);

      const result = await service.getSharedAccounts('space-123', 'user-456');

      expect(result).toHaveLength(1);
      expect(result[0].permission.canView).toBe(true);
    });

    it('should exclude expired permissions', async () => {
      prisma.accountSharingPermission.findMany.mockResolvedValue([]);

      const result = await service.getSharedAccounts('space-123', 'user-456');

      expect(prisma.accountSharingPermission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
          }),
        })
      );
      expect(result).toHaveLength(0);
    });
  });
});
