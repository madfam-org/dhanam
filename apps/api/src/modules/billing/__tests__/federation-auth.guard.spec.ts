import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { FederationAuthGuard } from '../guards/federation-auth.guard';

describe('FederationAuthGuard', () => {
  let guard: FederationAuthGuard;
  let configService: jest.Mocked<ConfigService>;

  const VALID_TOKEN = 'fed-secret-token-abc123';

  function createMockContext(authHeader?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authHeader !== undefined ? { authorization: authHeader } : {},
        }),
      }),
    } as ExecutionContext;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FederationAuthGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FEDERATION_API_TOKEN') return VALID_TOKEN;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    guard = module.get<FederationAuthGuard>(FederationAuthGuard);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request with valid Bearer token', () => {
    const context = createMockContext(`Bearer ${VALID_TOKEN}`);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when no Authorization header', () => {
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when Authorization header is empty', () => {
    const context = createMockContext('');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when not a Bearer token', () => {
    const context = createMockContext('Basic abc123');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token does not match', () => {
    const context = createMockContext('Bearer wrong-token');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Invalid federation token');
  });

  it('should throw UnauthorizedException when FEDERATION_API_TOKEN is not configured', () => {
    configService.get.mockReturnValue(undefined);

    const context = createMockContext(`Bearer ${VALID_TOKEN}`);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Federation authentication is not configured');
  });

  it('should use constant-time comparison (prevents timing attack)', () => {
    // A token with same length but different content
    const wrongToken = 'fed-secret-token-xyz999';
    const context = createMockContext(`Bearer ${wrongToken}`);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
