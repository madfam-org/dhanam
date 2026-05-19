import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { AdminGuard } from '../admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<LoggerService>;

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const mockPrisma = {
      userSpace: {
        findMany: jest.fn(),
      },
    };

    const mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
    prisma = module.get(PrismaService);
    logger = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should throw ForbiddenException when no user in request', async () => {
      const context = createMockExecutionContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('User not authenticated');
    });

    it('should throw ForbiddenException when user is null', async () => {
      const context = createMockExecutionContext(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should return true when user has admin role in a space', async () => {
      const context = createMockExecutionContext({ id: 'user-123' });

      prisma.userSpace.findMany
        .mockResolvedValueOnce([
          { userId: 'user-123', role: 'admin', space: { id: 'space-1', name: 'Admin Space' } },
        ] as any)
        .mockResolvedValueOnce([]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(logger.log).toHaveBeenCalledWith(
        'Admin access granted to user user-123',
        'AdminGuard'
      );
    });

    it('should return true when user is owner of a space', async () => {
      const context = createMockExecutionContext({ id: 'user-123' });

      prisma.userSpace.findMany
        .mockResolvedValueOnce([]) // No admin spaces
        .mockResolvedValueOnce([
          { userId: 'user-123', role: 'owner', space: { id: 'space-1', name: 'My Space' } },
        ] as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when user has both admin and owner roles', async () => {
      const context = createMockExecutionContext({ id: 'user-123' });

      prisma.userSpace.findMany
        .mockResolvedValueOnce([
          { userId: 'user-123', role: 'admin', space: { id: 'space-1' } },
        ] as any)
        .mockResolvedValueOnce([
          { userId: 'user-123', role: 'owner', space: { id: 'space-2' } },
        ] as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user has no admin or owner roles', async () => {
      const context = createMockExecutionContext({ id: 'user-123' });

      // Need to set up mocks for both calls each time canActivate is called
      prisma.userSpace.findMany
        .mockResolvedValueOnce([]) // No admin spaces (first canActivate)
        .mockResolvedValueOnce([]) // No owned spaces (first canActivate)
        .mockResolvedValueOnce([]) // No admin spaces (second canActivate for error message check)
        .mockResolvedValueOnce([]); // No owned spaces (second canActivate)

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Admin access required');
    });

    it('should log warning when non-admin user attempts access', async () => {
      const context = createMockExecutionContext({ id: 'user-456' });

      prisma.userSpace.findMany
        .mockResolvedValueOnce([]) // No admin spaces
        .mockResolvedValueOnce([]); // No owned spaces

      try {
        await guard.canActivate(context);
      } catch {
        // Expected to throw
      }

      expect(logger.warn).toHaveBeenCalledWith(
        'Non-admin user user-456 attempted to access admin endpoint',
        'AdminGuard'
      );
    });

    it('should query for admin spaces correctly', async () => {
      const context = createMockExecutionContext({ id: 'user-123' });

      prisma.userSpace.findMany.mockResolvedValue([
        { userId: 'user-123', role: 'admin', space: {} },
      ] as any);

      await guard.canActivate(context);

      expect(prisma.userSpace.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          role: 'admin',
        },
        include: {
          space: true,
        },
      });
    });

    it('should query for owned spaces correctly', async () => {
      const context = createMockExecutionContext({ id: 'user-123' });

      prisma.userSpace.findMany
        .mockResolvedValueOnce([]) // First call for admin
        .mockResolvedValueOnce([{ userId: 'user-123', role: 'owner', space: {} }] as any);

      await guard.canActivate(context);

      expect(prisma.userSpace.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          userId: 'user-123',
          role: 'owner',
        },
        include: {
          space: true,
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      const context = createMockExecutionContext({ id: 'user-123' });

      prisma.userSpace.findMany.mockRejectedValue(new Error('Database error'));

      await expect(guard.canActivate(context)).rejects.toThrow('Database error');
    });

    it('should check admin role before owner role', async () => {
      const context = createMockExecutionContext({ id: 'user-123' });
      const callOrder: string[] = [];

      prisma.userSpace.findMany
        .mockImplementationOnce(async (args) => {
          callOrder.push(args?.where?.role as string);
          return [];
        })
        .mockImplementationOnce(async (args) => {
          callOrder.push(args?.where?.role as string);
          return [{ userId: 'user-123', role: 'owner', space: {} }];
        });

      await guard.canActivate(context);

      expect(callOrder).toEqual(['admin', 'owner']);
    });
  });

  describe('user identification', () => {
    it('should correctly extract user id from request', async () => {
      const testUser = { id: 'specific-user-id', email: 'test@example.com' };
      const context = createMockExecutionContext(testUser);

      prisma.userSpace.findMany.mockResolvedValue([
        { userId: 'specific-user-id', role: 'admin', space: {} },
      ] as any);

      await guard.canActivate(context);

      expect(prisma.userSpace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'specific-user-id',
          }),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle user with empty id', async () => {
      const context = createMockExecutionContext({ id: '' });

      prisma.userSpace.findMany.mockResolvedValue([]);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should handle multiple admin spaces', async () => {
      const context = createMockExecutionContext({ id: 'user-123' });

      prisma.userSpace.findMany.mockResolvedValueOnce([
        { userId: 'user-123', role: 'admin', space: { id: 'space-1' } },
        { userId: 'user-123', role: 'admin', space: { id: 'space-2' } },
        { userId: 'user-123', role: 'admin', space: { id: 'space-3' } },
      ] as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
