import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PostHogService } from '../analytics/posthog.service';

import { ProvidersAnalytics } from './providers.analytics';

describe('ProvidersAnalytics', () => {
  let service: ProvidersAnalytics;
  let posthogService: jest.Mocked<PostHogService>;

  const mockPostHogService = {
    capture: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersAnalytics,
        {
          provide: PostHogService,
          useValue: mockPostHogService,
        },
      ],
    }).compile();

    // Suppress logger output
    module.get<ProvidersAnalytics>(ProvidersAnalytics)['logger'] = {
      error: jest.fn(),
    } as any;

    service = module.get<ProvidersAnalytics>(ProvidersAnalytics);
    posthogService = module.get(PostHogService);
  });

  describe('trackSyncSuccess', () => {
    it('should track successful provider sync', async () => {
      await service.trackSyncSuccess('user-123', 'belvo', {
        accountCount: 5,
        transactionCount: 150,
        duration: 2500,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'sync_success',
        properties: {
          provider: 'belvo',
          account_count: 5,
          transaction_count: 150,
          duration_ms: 2500,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackSyncSuccess('user-123', 'plaid', {
          accountCount: 3,
          transactionCount: 75,
          duration: 1500,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('trackSyncFailed', () => {
    it('should track failed provider sync', async () => {
      await service.trackSyncFailed('user-456', 'bitso', 'API timeout');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'sync_failed',
        properties: {
          provider: 'bitso',
          error_message: 'API timeout',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackSyncFailed('user-123', 'belvo', 'Connection failed')
      ).resolves.not.toThrow();
    });
  });

  describe('trackConnectionInitiated', () => {
    it('should track connection initiation with institution', async () => {
      await service.trackConnectionInitiated('user-123', 'belvo', 'BBVA Mexico');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'connect_initiated',
        properties: {
          provider: 'belvo',
          institution: 'BBVA Mexico',
        },
      });
    });

    it('should track connection initiation without institution', async () => {
      await service.trackConnectionInitiated('user-456', 'bitso');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'connect_initiated',
        properties: {
          provider: 'bitso',
          institution: undefined,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackConnectionInitiated('user-123', 'plaid', 'Chase')
      ).resolves.not.toThrow();
    });
  });

  describe('trackConnectionSuccess', () => {
    it('should track successful connection with all metadata', async () => {
      await service.trackConnectionSuccess('user-123', 'plaid', {
        institution: 'Bank of America',
        accountCount: 4,
        connectionTime: 3200,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'connect_success',
        properties: {
          provider: 'plaid',
          institution: 'Bank of America',
          account_count: 4,
          connection_time_ms: 3200,
        },
      });
    });

    it('should track successful connection without institution', async () => {
      await service.trackConnectionSuccess('user-456', 'bitso', {
        accountCount: 1,
        connectionTime: 1500,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'connect_success',
        properties: {
          provider: 'bitso',
          institution: undefined,
          account_count: 1,
          connection_time_ms: 1500,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackConnectionSuccess('user-123', 'belvo', {
          accountCount: 2,
          connectionTime: 2000,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('trackConnectionFailed', () => {
    it('should track failed connection with institution', async () => {
      await service.trackConnectionFailed('user-123', 'belvo', 'Invalid credentials', 'Banorte');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'connect_failed',
        properties: {
          provider: 'belvo',
          institution: 'Banorte',
          error_message: 'Invalid credentials',
        },
      });
    });

    it('should track failed connection without institution', async () => {
      await service.trackConnectionFailed('user-456', 'plaid', 'Network error');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'connect_failed',
        properties: {
          provider: 'plaid',
          institution: undefined,
          error_message: 'Network error',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackConnectionFailed('user-123', 'bitso', 'API error')
      ).resolves.not.toThrow();
    });
  });

  describe('trackConnectionDisconnected', () => {
    it('should track disconnection with reason', async () => {
      await service.trackConnectionDisconnected('user-123', 'plaid', 'expired_credentials');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'connect_disconnected',
        properties: {
          provider: 'plaid',
          reason: 'expired_credentials',
        },
      });
    });

    it('should track disconnection without reason (default to user_initiated)', async () => {
      await service.trackConnectionDisconnected('user-456', 'belvo');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'connect_disconnected',
        properties: {
          provider: 'belvo',
          reason: 'user_initiated',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackConnectionDisconnected('user-123', 'bitso', 'security_breach')
      ).resolves.not.toThrow();
    });
  });

  describe('trackManualRefresh', () => {
    it('should track manual account refresh', async () => {
      await service.trackManualRefresh('user-123', 'belvo', 'account-456');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'manual_refresh',
        properties: {
          provider: 'belvo',
          account_id: 'account-456',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackManualRefresh('user-123', 'plaid', 'account-789')
      ).resolves.not.toThrow();
    });
  });

  describe('trackWebhookReceived', () => {
    it('should track webhook received and processed', async () => {
      await service.trackWebhookReceived('belvo', 'transactions_updated', true);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'system',
        event: 'provider_webhook_received',
        properties: {
          provider: 'belvo',
          event_type: 'transactions_updated',
          processed: true,
        },
      });
    });

    it('should track webhook received but not processed', async () => {
      await service.trackWebhookReceived('plaid', 'item_error', false);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'system',
        event: 'provider_webhook_received',
        properties: {
          provider: 'plaid',
          event_type: 'item_error',
          processed: false,
        },
      });
    });

    it('should use "system" as distinctId for webhooks', async () => {
      await service.trackWebhookReceived('bitso', 'balance_updated', true);

      const captureCall = posthogService.capture.mock.calls[0][0];
      expect(captureCall.distinctId).toBe('system');
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackWebhookReceived('belvo', 'account_created', true)
      ).resolves.not.toThrow();
    });
  });
});
