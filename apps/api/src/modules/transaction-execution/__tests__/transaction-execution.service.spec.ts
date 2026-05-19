import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../../../core/audit/audit.service';
import { MFA_PROVIDER } from '../../../core/auth/providers';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SpacesService } from '../../spaces/spaces.service';
import {
  CreateOrderDto,
  OrderType,
  OrderPriority,
  ExecutionProvider,
} from '../dto/create-order.dto';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { TransactionExecutionService } from '../transaction-execution.service';

describe('TransactionExecutionService', () => {
  let service: TransactionExecutionService;
  let prisma: PrismaService;
  let audit: AuditService;
  let spaces: SpacesService;
  let providerFactory: ProviderFactoryService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    totpEnabled: false,
  };

  const mockSpace = {
    id: 'space-123',
    name: 'Test Space',
    type: 'personal',
  };

  const mockAccount = {
    id: 'account-123',
    spaceId: mockSpace.id,
    name: 'Test Account',
    balance: 10000,
    currency: 'USD',
  };

  const mockOrder = {
    id: 'order-123',
    spaceId: mockSpace.id,
    userId: mockUser.id,
    accountId: mockAccount.id,
    idempotencyKey: 'test-idempotency-key',
    type: 'buy',
    status: 'pending_verification',
    priority: 'normal',
    amount: 1000,
    currency: 'USD',
    assetSymbol: 'BTC',
    provider: 'bitso',
    dryRun: false,
    otpVerified: false,
    autoExecute: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    account: mockAccount,
    toAccount: null,
    goal: null,
    executions: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionExecutionService,
        {
          provide: PrismaService,
          useValue: {
            transactionOrder: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            orderExecution: {
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            idempotencyKey: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            account: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            orderLimit: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: MFA_PROVIDER,
          useValue: {
            verifyToken: jest.fn().mockImplementation((_secret: string, token: string) => {
              // Simple mock: 6-digit codes are valid
              return /^\d{6}$/.test(token);
            }),
            verifyBackupCode: jest.fn().mockResolvedValue(false),
            generateSecret: jest.fn().mockReturnValue('mock-secret'),
            generateQRCodeURL: jest.fn().mockReturnValue('mock-qr-url'),
          },
        },
        {
          provide: SpacesService,
          useValue: {
            verifyUserAccess: jest.fn(),
          },
        },
        {
          provide: ProviderFactoryService,
          useValue: {
            getProvider: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionExecutionService>(TransactionExecutionService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    spaces = module.get<SpacesService>(SpacesService);
    providerFactory = module.get<ProviderFactoryService>(ProviderFactoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    const createOrderDto: CreateOrderDto = {
      accountId: mockAccount.id,
      idempotencyKey: 'test-idempotency-key',
      type: OrderType.buy,
      priority: OrderPriority.normal,
      amount: 1000,
      currency: 'USD' as any,
      assetSymbol: 'BTC',
      provider: ExecutionProvider.bitso,
      dryRun: false,
    };

    it('should create a new order successfully', async () => {
      (spaces.verifyUserAccess as jest.Mock).mockResolvedValue(undefined);
      (prisma.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.orderLimit.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.transactionOrder.create as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      const result = await service.createOrder(
        mockSpace.id,
        mockUser.id,
        createOrderDto,
        '127.0.0.1',
        'test-user-agent'
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(mockOrder.id);
      expect(spaces.verifyUserAccess).toHaveBeenCalledWith(mockUser.id, mockSpace.id, 'member');
      expect(audit.log).toHaveBeenCalled();
    });

    it('should return existing order for duplicate idempotency key', async () => {
      // Compute the actual hash from the DTO
      const crypto = require('crypto');
      const requestHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(createOrderDto))
        .digest('hex');

      const existingIdempotencyKey = {
        key: 'test-idempotency-key',
        requestHash,
        orderId: mockOrder.id,
        expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      };

      (spaces.verifyUserAccess as jest.Mock).mockResolvedValue(undefined);
      (prisma.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(existingIdempotencyKey);
      (prisma.transactionOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await service.createOrder(
        mockSpace.id,
        mockUser.id,
        createOrderDto,
        '127.0.0.1',
        'test-user-agent'
      );

      expect(result.id).toBe(mockOrder.id);
      expect(prisma.transactionOrder.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for idempotency key with different request', async () => {
      const existingIdempotencyKey = {
        key: 'test-idempotency-key',
        requestHash: 'different-hash',
        orderId: mockOrder.id,
        expiresAt: new Date(Date.now() + 86400000),
      };

      (spaces.verifyUserAccess as jest.Mock).mockResolvedValue(undefined);
      (prisma.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(existingIdempotencyKey);

      await expect(
        service.createOrder(
          mockSpace.id,
          mockUser.id,
          createOrderDto,
          '127.0.0.1',
          'test-user-agent'
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException if account does not belong to space', async () => {
      (spaces.verifyUserAccess as jest.Mock).mockResolvedValue(undefined);
      (prisma.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createOrder(
          mockSpace.id,
          mockUser.id,
          createOrderDto,
          '127.0.0.1',
          'test-user-agent'
        )
      ).rejects.toThrow('Account not found or does not belong to this space');
    });

    it('should throw BadRequestException if order exceeds limits', async () => {
      const orderLimit = {
        id: 'limit-123',
        userId: mockUser.id,
        limitType: 'daily',
        maxAmount: 5000,
        usedAmount: 4500,
        currency: 'USD',
        resetAt: new Date(Date.now() + 86400000),
        enforced: true,
      };

      (spaces.verifyUserAccess as jest.Mock).mockResolvedValue(undefined);
      (prisma.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.orderLimit.findMany as jest.Mock).mockResolvedValue([orderLimit]);

      await expect(
        service.createOrder(
          mockSpace.id,
          mockUser.id,
          createOrderDto,
          '127.0.0.1',
          'test-user-agent'
        )
      ).rejects.toThrow('Order exceeds');
    });

    it('should create order with pending_verification for high-value transactions', async () => {
      const highValueDto = { ...createOrderDto, amount: 15000 };

      (spaces.verifyUserAccess as jest.Mock).mockResolvedValue(undefined);
      (prisma.idempotencyKey.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.orderLimit.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.transactionOrder.create as jest.Mock).mockResolvedValue({
        ...mockOrder,
        amount: 15000,
        status: 'pending_verification',
      });
      (prisma.idempotencyKey.create as jest.Mock).mockResolvedValue({});

      const result = await service.createOrder(
        mockSpace.id,
        mockUser.id,
        highValueDto,
        '127.0.0.1',
        'test-user-agent'
      );

      expect(result.status).toBe('pending_verification');
    });
  });

  describe('verifyOrder', () => {
    it('should verify order with valid OTP', async () => {
      const pendingOrder = { ...mockOrder, status: 'pending_verification' };
      const userWithTotp = {
        ...mockUser,
        totpEnabled: true,
        totpSecret: 'test-secret-key',
      };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(pendingOrder);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithTotp);
      (prisma.transactionOrder.update as jest.Mock).mockResolvedValue({
        ...pendingOrder,
        status: 'pending_execution',
        otpVerified: true,
      });

      // Mock mfaProvider to verify the OTP code
      const mfaProvider = service['mfaProvider'];
      jest.spyOn(mfaProvider, 'verifyToken').mockReturnValue(true);

      const result = await service.verifyOrder(
        mockOrder.id,
        mockUser.id,
        { otpCode: '123456' },
        '127.0.0.1',
        'test-user-agent'
      );

      expect(result.status).toBe('pending_execution');
      expect(result.otpVerified).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'order_verified',
        })
      );
    });

    it('should throw BadRequestException for invalid order status', async () => {
      const executingOrder = { ...mockOrder, status: 'executing' };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(executingOrder);

      await expect(
        service.verifyOrder(mockOrder.id, mockUser.id, { otpCode: '123456' })
      ).rejects.toThrow('Order is not pending verification');
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const pendingOrder = { ...mockOrder, status: 'pending_verification' };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(pendingOrder);
      // Invalid OTP format will be rejected before hitting the TOTP service

      await expect(
        service.verifyOrder(mockOrder.id, mockUser.id, { otpCode: 'invalid' })
      ).rejects.toThrow('Invalid OTP code');
    });
  });

  describe('executeOrder', () => {
    it('should execute order in dry-run mode successfully', async () => {
      const dryRunOrder = {
        ...mockOrder,
        status: 'pending_execution',
        dryRun: true,
      };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(dryRunOrder);
      (prisma.transactionOrder.update as jest.Mock).mockImplementation((args) => {
        if (args.data.status === 'executing') {
          return Promise.resolve({ ...dryRunOrder, status: 'executing' });
        }
        return Promise.resolve({ ...dryRunOrder, status: 'completed' });
      });
      (prisma.orderExecution.create as jest.Mock).mockResolvedValue({
        id: 'execution-123',
        orderId: mockOrder.id,
        startedAt: new Date(),
      });
      (prisma.orderExecution.update as jest.Mock).mockResolvedValue({});
      (prisma.orderLimit.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.executeOrder(
        mockOrder.id,
        mockUser.id,
        '127.0.0.1',
        'test-user-agent'
      );

      expect(result.status).toBe('completed');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'order_executed',
        })
      );
    });

    it('should throw BadRequestException for invalid order status', async () => {
      const completedOrder = { ...mockOrder, status: 'completed' };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(completedOrder);

      await expect(service.executeOrder(mockOrder.id, mockUser.id)).rejects.toThrow(
        'Order cannot be executed in status: completed'
      );
    });

    it('should throw BadRequestException for expired order', async () => {
      const expiredOrder = {
        ...mockOrder,
        status: 'pending_execution',
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
      };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(expiredOrder);
      (prisma.transactionOrder.update as jest.Mock).mockResolvedValue({
        ...expiredOrder,
        status: 'rejected',
      });

      await expect(service.executeOrder(mockOrder.id, mockUser.id)).rejects.toThrow(
        'Order has expired'
      );
    });
  });

  describe('cancelOrder', () => {
    it('should cancel pending order successfully', async () => {
      const pendingOrder = { ...mockOrder, status: 'pending_verification' };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(pendingOrder);
      (prisma.transactionOrder.update as jest.Mock).mockResolvedValue({
        ...pendingOrder,
        status: 'cancelled',
      });

      const result = await service.cancelOrder(
        mockOrder.id,
        mockUser.id,
        '127.0.0.1',
        'test-user-agent'
      );

      expect(result.status).toBe('cancelled');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'order_cancelled',
        })
      );
    });

    it('should throw BadRequestException when canceling executing order', async () => {
      const executingOrder = { ...mockOrder, status: 'executing' };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(executingOrder);

      await expect(service.cancelOrder(mockOrder.id, mockUser.id)).rejects.toThrow(
        'Cannot cancel order in status: executing'
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      const orders = [mockOrder, { ...mockOrder, id: 'order-456' }];

      (spaces.verifyUserAccess as jest.Mock).mockResolvedValue(undefined);
      (prisma.transactionOrder.findMany as jest.Mock).mockResolvedValue(orders);
      (prisma.transactionOrder.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findAll(mockSpace.id, mockUser.id, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter orders by status', async () => {
      const completedOrders = [{ ...mockOrder, status: 'completed' }];

      (spaces.verifyUserAccess as jest.Mock).mockResolvedValue(undefined);
      (prisma.transactionOrder.findMany as jest.Mock).mockResolvedValue(completedOrders);
      (prisma.transactionOrder.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(mockSpace.id, mockUser.id, {
        status: 'completed' as any,
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('completed');
    });
  });

  describe('findOne', () => {
    it('should return order with executions', async () => {
      const executions = [
        {
          id: 'execution-123',
          orderId: mockOrder.id,
          attemptNumber: 1,
          status: 'completed',
        },
      ];

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.orderExecution.findMany as jest.Mock).mockResolvedValue(executions);

      const result = await service.findOne(mockOrder.id, mockUser.id);

      expect(result.id).toBe(mockOrder.id);
      expect(result.executions).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent order', async () => {
      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-existent-id', mockUser.id)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateOrder', () => {
    it('should update pending order', async () => {
      const pendingOrder = { ...mockOrder, status: 'pending_verification' };
      const updateDto = { amount: 1500, notes: 'Updated order' };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(pendingOrder);
      (prisma.transactionOrder.update as jest.Mock).mockResolvedValue({
        ...pendingOrder,
        ...updateDto,
      });

      const result = await service.updateOrder(
        mockOrder.id,
        mockUser.id,
        updateDto,
        '127.0.0.1',
        'test-user-agent'
      );

      expect(result.amount).toBe(updateDto.amount);
      expect(result.notes).toBe(updateDto.notes);
    });

    it('should throw BadRequestException when updating executing order', async () => {
      const executingOrder = { ...mockOrder, status: 'executing' };

      (prisma.transactionOrder.findFirst as jest.Mock).mockResolvedValue(executingOrder);

      await expect(
        service.updateOrder(mockOrder.id, mockUser.id, { amount: 1500 })
      ).rejects.toThrow('Cannot update order in status: executing');
    });
  });
});
