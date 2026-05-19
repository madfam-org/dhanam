import { Account, SyncAccountResponse, AccountType } from '@dhanam/shared';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { AccountOwnership as _AccountOwnership } from '@db';

import { BelvoService } from '../providers/belvo/belvo.service';
import { BitsoService } from '../providers/bitso/bitso.service';
import { PlaidService } from '../providers/plaid/plaid.service';

import { ConnectAccountDto } from './dto/connect-account.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { ShareAccountDto, UpdateSharingPermissionDto } from './dto/share-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateOwnershipDto } from './dto/update-ownership.dto';

@Injectable()
export class AccountsService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private plaidService: PlaidService,
    private bitsoService: BitsoService,
    @Inject(forwardRef(() => BelvoService))
    private belvoService: BelvoService
  ) {}

  async listAccounts(spaceId: string, type?: string): Promise<Account[]> {
    const accounts = await this.prisma.account.findMany({
      where: {
        spaceId,
        ...(type && { type: type as AccountType }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return accounts.map(this.sanitizeAccount);
  }

  async createAccount(spaceId: string, dto: CreateAccountDto): Promise<Account> {
    const account = await this.prisma.account.create({
      data: {
        spaceId,
        name: dto.name,
        type: dto.type,
        subtype: dto.subtype,
        currency: dto.currency as unknown as import('@db').Currency,
        balance: dto.balance,
        provider: 'manual',
      },
    });

    this.logger.log(
      `Manual account created: ${account.id} in space: ${spaceId}`,
      'AccountsService'
    );

    return this.sanitizeAccount(account);
  }

  async connectAccount(
    spaceId: string,
    userId: string,
    dto: ConnectAccountDto
  ): Promise<Account[]> {
    if (!['belvo', 'plaid', 'bitso'].includes(dto.provider)) {
      throw new BadRequestException('Invalid provider');
    }

    // Route to appropriate provider
    switch (dto.provider) {
      case 'belvo':
        // Belvo uses a different OAuth flow - redirect to dedicated endpoint
        throw new BadRequestException(
          'Belvo connections should be initiated through /providers/belvo/link endpoint'
        );

      case 'plaid': {
        // Plaid requires a public token from Link flow
        if (!dto.linkToken) {
          throw new BadRequestException(
            'Plaid connections require a linkToken (public token from Plaid Link)'
          );
        }
        const plaidResult = await this.plaidService.createLink(spaceId, userId, {
          publicToken: dto.linkToken,
          externalId: dto.credentials?.externalId,
        });
        this.logger.log(
          `Plaid account connected for user ${userId}, ${plaidResult.accounts.length} accounts synced`,
          'AccountsService'
        );
        return plaidResult.accounts.map(this.sanitizeAccount);
      }

      case 'bitso': {
        // Bitso requires API key and secret
        if (!dto.credentials?.apiKey || !dto.credentials?.apiSecret) {
          throw new BadRequestException(
            'Bitso connections require apiKey and apiSecret in credentials'
          );
        }
        const bitsoResult = await this.bitsoService.connectAccount(spaceId, userId, {
          apiKey: dto.credentials.apiKey,
          apiSecret: dto.credentials.apiSecret,
          externalId: dto.credentials.externalId,
          autoSync: dto.credentials.autoSync ?? true,
        });
        this.logger.log(
          `Bitso account connected for user ${userId}, ${bitsoResult.accounts.length} accounts synced`,
          'AccountsService'
        );
        return bitsoResult.accounts.map(this.sanitizeAccount);
      }

      default:
        throw new BadRequestException(`Unknown provider: ${dto.provider}`);
    }
  }

  async getAccount(spaceId: string, accountId: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return this.sanitizeAccount(account);
  }

  async updateAccount(spaceId: string, accountId: string, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.provider !== 'manual' && dto.balance !== undefined) {
      throw new BadRequestException('Cannot manually update balance for connected accounts');
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        name: dto.name,
        balance: dto.balance,
      },
    });

    this.logger.log(`Account updated: ${accountId}`, 'AccountsService');

    return this.sanitizeAccount(updated);
  }

  async deleteAccount(spaceId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    await this.prisma.account.delete({
      where: { id: accountId },
    });

    this.logger.log(`Account deleted: ${accountId}`, 'AccountsService');
  }

  async syncAccount(spaceId: string, accountId: string): Promise<SyncAccountResponse> {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.provider === 'manual') {
      throw new BadRequestException('Cannot sync manual accounts');
    }

    const jobId = uuidv4();

    switch (account.provider) {
      case 'belvo': {
        const linkId = this.readMetadataString(account.metadata, 'linkId');
        if (!linkId) {
          throw new BadRequestException('Belvo account missing link metadata');
        }
        await this.belvoService.syncTransactions(spaceId, '', linkId);
        break;
      }

      case 'plaid': {
        await this.plaidService.fetchTransactionsByDateRange(
          accountId,
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        );
        break;
      }

      case 'bitso': {
        const clientId = this.readMetadataString(account.metadata, 'clientId');
        if (!clientId) {
          throw new BadRequestException('Bitso account missing client metadata');
        }
        const connection = await this.prisma.providerConnection.findFirst({
          where: { provider: 'bitso', providerUserId: clientId },
          select: { id: true },
        });
        if (!connection) {
          throw new BadRequestException('Bitso connection not found');
        }
        await this.bitsoService.fetchBalances(connection.id);
        break;
      }

      default:
        throw new BadRequestException(`Sync not supported for provider ${account.provider}`);
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        lastSyncedAt: new Date(),
      },
    });

    this.logger.log(`Account sync initiated: ${accountId}, job: ${jobId}`, 'AccountsService');

    return {
      jobId,
      status: 'completed',
    };
  }

  private readMetadataString(metadata: unknown, key: string): string | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }

    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  /**
   * Update account ownership (Yours/Mine/Ours visibility)
   */
  async updateOwnership(
    spaceId: string,
    accountId: string,
    userId: string,
    dto: UpdateOwnershipDto
  ): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Validate ownership rules
    if (dto.ownership === 'individual' && !dto.ownerId) {
      throw new BadRequestException('Individual accounts require an ownerId');
    }

    if (dto.ownership === 'joint' && dto.ownerId) {
      throw new BadRequestException('Joint accounts should not have an ownerId');
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        ownership: dto.ownership,
        ownerId: dto.ownership === 'individual' ? dto.ownerId : null,
      },
    });

    this.logger.log(
      `Account ownership updated: ${accountId} to ${dto.ownership}`,
      'AccountsService'
    );

    return this.sanitizeAccount(updated);
  }

  /**
   * Get accounts filtered by ownership (Yours/Mine/Ours)
   * - 'yours': Accounts owned by the current user
   * - 'mine': Accounts owned by other household members
   * - 'ours': Joint/shared accounts
   */
  async getAccountsByOwnership(
    spaceId: string,
    userId: string,
    filter: 'yours' | 'mine' | 'ours'
  ): Promise<Account[]> {
    const whereClause: any = { spaceId };

    switch (filter) {
      case 'yours':
        // Show accounts owned by current user
        whereClause.ownership = 'individual';
        whereClause.ownerId = userId;
        break;

      case 'mine':
        // Show accounts owned by others (not current user)
        whereClause.ownership = 'individual';
        whereClause.NOT = { ownerId: userId };
        break;

      case 'ours':
        // Show joint/shared accounts
        whereClause.ownership = 'joint';
        break;

      default:
        throw new BadRequestException('Invalid ownership filter');
    }

    const accounts = await this.prisma.account.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return accounts.map(this.sanitizeAccount);
  }

  /**
   * Get aggregated net worth by ownership (for Yours/Mine/Ours dashboard)
   */
  async getNetWorthByOwnership(
    spaceId: string,
    userId: string
  ): Promise<{
    yours: number;
    mine: number;
    ours: number;
    total: number;
  }> {
    const [yoursAccounts, mineAccounts, oursAccounts] = await Promise.all([
      this.prisma.account.findMany({
        where: { spaceId, ownership: 'individual', ownerId: userId },
        select: { balance: true },
      }),
      this.prisma.account.findMany({
        where: { spaceId, ownership: 'individual', NOT: { ownerId: userId } },
        select: { balance: true },
      }),
      this.prisma.account.findMany({
        where: { spaceId, ownership: 'joint' },
        select: { balance: true },
      }),
    ]);

    const calculateTotal = (accounts: any[]) =>
      accounts.reduce((sum, acc) => sum + parseFloat(acc.balance.toString()), 0);

    const yours = calculateTotal(yoursAccounts);
    const mine = calculateTotal(mineAccounts);
    const ours = calculateTotal(oursAccounts);

    return {
      yours,
      mine,
      ours,
      total: yours + mine + ours,
    };
  }

  /**
   * Share an account with another user (for Yours/Mine/Ours flexibility)
   */
  async shareAccount(spaceId: string, accountId: string, ownerId: string, dto: ShareAccountDto) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Verify requester is the owner
    if (account.ownerId !== ownerId) {
      throw new ForbiddenException('Only the account owner can share access');
    }

    // Check if sharing permission already exists
    const existing = await this.prisma.accountSharingPermission.findUnique({
      where: {
        accountId_sharedWithId: {
          accountId,
          sharedWithId: dto.sharedWithId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Account already shared with this user');
    }

    const permission = await this.prisma.accountSharingPermission.create({
      data: {
        accountId,
        sharedWithId: dto.sharedWithId,
        canView: dto.canView ?? true,
        canEdit: dto.canEdit ?? false,
        canDelete: dto.canDelete ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Account ${accountId} shared with user ${dto.sharedWithId}`, 'AccountsService');

    return permission;
  }

  /**
   * Update sharing permissions
   */
  async updateSharingPermission(
    spaceId: string,
    accountId: string,
    permissionId: string,
    ownerId: string,
    dto: UpdateSharingPermissionDto
  ) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.ownerId !== ownerId) {
      throw new ForbiddenException('Only the account owner can update permissions');
    }

    const permission = await this.prisma.accountSharingPermission.update({
      where: { id: permissionId },
      data: {
        canView: dto.canView,
        canEdit: dto.canEdit,
        canDelete: dto.canDelete,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Sharing permission ${permissionId} updated`, 'AccountsService');

    return permission;
  }

  /**
   * Revoke sharing permission
   */
  async revokeSharingPermission(
    spaceId: string,
    accountId: string,
    permissionId: string,
    ownerId: string
  ) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.ownerId !== ownerId) {
      throw new ForbiddenException('Only the account owner can revoke permissions');
    }

    await this.prisma.accountSharingPermission.delete({
      where: { id: permissionId },
    });

    this.logger.log(`Sharing permission ${permissionId} revoked`, 'AccountsService');
  }

  /**
   * Get all sharing permissions for an account
   */
  async getAccountSharingPermissions(spaceId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const permissions = await this.prisma.accountSharingPermission.findMany({
      where: { accountId },
      include: {
        sharedWith: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return permissions;
  }

  /**
   * Get all accounts shared with the current user
   */
  async getSharedAccounts(spaceId: string, userId: string) {
    const permissions = await this.prisma.accountSharingPermission.findMany({
      where: {
        sharedWithId: userId,
        account: { spaceId },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        account: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return permissions.map((p) => ({
      ...this.sanitizeAccount(p.account),
      permission: {
        id: p.id,
        canView: p.canView,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        expiresAt: p.expiresAt,
      },
    }));
  }

  private sanitizeAccount(account: any): Account {
    const { encryptedCredentials: _encryptedCredentials, ...sanitized } = account;
    return {
      ...sanitized,
      balance: parseFloat(account.balance.toString()),
    };
  }
}
