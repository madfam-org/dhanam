import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { AdminGuard } from '../admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let prisma: { user: { findUnique: jest.Mock } };
  let logger: jest.Mocked<LoggerService>;

  const createMockExecutionContext = (user?: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
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
    prisma = module.get(PrismaService) as unknown as { user: { findUnique: jest.Mock } };
    logger = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws ForbiddenException when no user is authenticated', async () => {
    await expect(guard.canActivate(createMockExecutionContext())).rejects.toThrow(
      new ForbiddenException('User not authenticated')
    );
  });

  it('allows a user with a verified admin claim without querying local fallback', async () => {
    const context = createMockExecutionContext({ id: 'user-123', isAdmin: true });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('Admin access granted to user user-123', 'AdminGuard');
  });

  it('allows a local platform admin when the request context lacks an admin claim', async () => {
    const context = createMockExecutionContext({ id: 'user-123' });
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('uses dhanamUserId from Janua-authenticated request context when present', async () => {
    const context = createMockExecutionContext({
      id: 'janua-user-123',
      dhanamUserId: 'local-user-123',
    });
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });

    await guard.canActivate(context);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'local-user-123' },
      select: { isAdmin: true },
    });
  });

  it('rejects users who only own or administer a regular space', async () => {
    const context = createMockExecutionContext({ id: 'space-owner-123' });
    prisma.user.findUnique.mockResolvedValue({ isAdmin: false });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Admin access required')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Non-admin user space-owner-123 attempted to access admin endpoint',
      'AdminGuard'
    );
  });

  it('rejects a user with an empty id', async () => {
    const context = createMockExecutionContext({ id: '' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Admin access required')
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('propagates database errors from the local admin lookup', async () => {
    const context = createMockExecutionContext({ id: 'user-123' });
    prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

    await expect(guard.canActivate(context)).rejects.toThrow('Database error');
  });
});
