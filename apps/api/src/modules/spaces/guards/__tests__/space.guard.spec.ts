import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { ROLES_KEY } from '../../decorators/require-role.decorator';
import { SpacesService } from '../../spaces.service';
import { SpaceGuard } from '../space.guard';

describe('SpaceGuard', () => {
  let guard: SpaceGuard;
  let reflector: jest.Mocked<Reflector>;
  let spacesService: jest.Mocked<SpacesService>;

  const createMockExecutionContext = (
    user?: any,
    params?: { spaceId?: string }
  ): ExecutionContext => {
    const request = {
      user,
      params: params || {},
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const mockSpacesService = {
      getUserRoleInSpace: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: SpacesService, useValue: mockSpacesService },
      ],
    }).compile();

    guard = module.get<SpaceGuard>(SpaceGuard);
    reflector = module.get(Reflector);
    spacesService = module.get(SpacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should throw ForbiddenException when no user in request', async () => {
      const context = createMockExecutionContext(undefined, { spaceId: 'space-123' });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Access denied');
    });

    it('should throw ForbiddenException when no spaceId in params', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, {});

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Access denied');
    });

    it('should throw ForbiddenException when both user and spaceId are missing', async () => {
      const context = createMockExecutionContext(undefined, {});

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is not a member of the space', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Not a member of this space');
    });

    it('should return true when user is member and no specific roles required', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('member' as any);
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when user has required role', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('admin' as any);
      reflector.getAllAndOverride.mockReturnValue(['admin', 'owner']);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user does not have required role', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('viewer' as any);
      reflector.getAllAndOverride.mockReturnValue(['admin', 'owner']);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Insufficient permissions');
    });

    it('should attach spaceRole to request', async () => {
      const request = {
        user: { id: 'user-123' },
        params: { spaceId: 'space-456' },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;

      spacesService.getUserRoleInSpace.mockResolvedValue('editor' as any);
      reflector.getAllAndOverride.mockReturnValue(undefined);

      await guard.canActivate(context);

      expect(request).toHaveProperty('spaceRole', 'editor');
    });

    it('should check roles from both handler and class', async () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user-123' },
            params: { spaceId: 'space-456' },
          }),
        }),
        getHandler: () => mockHandler,
        getClass: () => mockClass,
      } as unknown as ExecutionContext;

      spacesService.getUserRoleInSpace.mockResolvedValue('member' as any);
      reflector.getAllAndOverride.mockReturnValue(undefined);

      await guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [mockHandler, mockClass]);
    });

    it('should call spacesService with correct parameters', async () => {
      const context = createMockExecutionContext({ id: 'user-abc' }, { spaceId: 'space-xyz' });
      spacesService.getUserRoleInSpace.mockResolvedValue('owner' as any);
      reflector.getAllAndOverride.mockReturnValue(undefined);

      await guard.canActivate(context);

      expect(spacesService.getUserRoleInSpace).toHaveBeenCalledWith('user-abc', 'space-xyz');
    });
  });

  describe('role validation', () => {
    it('should accept owner role when owner is required', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('owner' as any);
      reflector.getAllAndOverride.mockReturnValue(['owner']);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should accept admin role when admin is required', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('admin' as any);
      reflector.getAllAndOverride.mockReturnValue(['admin']);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should accept member role when member is required', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('member' as any);
      reflector.getAllAndOverride.mockReturnValue(['member']);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should accept viewer role when viewer is required', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('viewer' as any);
      reflector.getAllAndOverride.mockReturnValue(['viewer']);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reject viewer when only admin/owner allowed', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('viewer' as any);
      reflector.getAllAndOverride.mockReturnValue(['admin', 'owner']);

      await expect(guard.canActivate(context)).rejects.toThrow('Insufficient permissions');
    });

    it('should throw when empty required roles array (no role matches)', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('viewer' as any);
      reflector.getAllAndOverride.mockReturnValue([]);

      // Empty array is truthy in JS, so requiredRoles is truthy
      // !requiredRoles.includes('viewer') is true (viewer not in empty array)
      // So the condition evaluates to true and throws Insufficient permissions
      await expect(guard.canActivate(context)).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('error handling', () => {
    it('should handle spacesService errors gracefully', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockRejectedValue(new Error('Service unavailable'));

      await expect(guard.canActivate(context)).rejects.toThrow('Service unavailable');
    });

    it('should handle null spaceId', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: null as any });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should handle undefined spaceId', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: undefined });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('integration scenarios', () => {
    it('should allow space owner to access admin-only endpoint', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('owner' as any);
      reflector.getAllAndOverride.mockReturnValue(['admin', 'owner']);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should block member from admin-only endpoint', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('member' as any);
      reflector.getAllAndOverride.mockReturnValue(['admin']);

      await expect(guard.canActivate(context)).rejects.toThrow('Insufficient permissions');
    });

    it('should allow any member to access unprotected endpoint', async () => {
      const context = createMockExecutionContext({ id: 'user-123' }, { spaceId: 'space-456' });
      spacesService.getUserRoleInSpace.mockResolvedValue('viewer' as any);
      reflector.getAllAndOverride.mockReturnValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
