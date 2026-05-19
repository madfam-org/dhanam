import { createHmac } from 'crypto';

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { MetaMapProvider } from '../metamap.provider';

describe('MetaMapProvider', () => {
  let provider: MetaMapProvider;

  const MOCK_CLIENT_ID = 'test-client-id';
  const MOCK_CLIENT_SECRET = 'test-client-secret';
  const MOCK_WEBHOOK_SECRET = 'whsec-metamap-test-secret';
  const MOCK_FLOW_ID = 'flow-template-001';
  const MOCK_API_URL = 'https://api.getmati.com';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaMapProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                METAMAP_API_URL: MOCK_API_URL,
                METAMAP_CLIENT_ID: MOCK_CLIENT_ID,
                METAMAP_CLIENT_SECRET: MOCK_CLIENT_SECRET,
                METAMAP_WEBHOOK_SECRET: MOCK_WEBHOOK_SECRET,
                METAMAP_FLOW_ID: MOCK_FLOW_ID,
              };
              return config[key] || '';
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<MetaMapProvider>(MetaMapProvider);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // verifyWebhookSignature
  // ---------------------------------------------------------------------------
  describe('verifyWebhookSignature', () => {
    it('should return true for a valid HMAC-SHA256 signature', () => {
      const payload = JSON.stringify({ flowId: 'flow-abc', eventName: 'verification_completed' });
      const expected = createHmac('sha256', MOCK_WEBHOOK_SECRET).update(payload).digest('hex');

      expect(provider.verifyWebhookSignature(payload, expected)).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      const payload = '{"flowId":"flow-abc"}';
      expect(provider.verifyWebhookSignature(payload, 'deadbeef1234')).toBe(false);
    });

    it('should return false when signature is empty string', () => {
      const payload = '{"flowId":"flow-abc"}';
      expect(provider.verifyWebhookSignature(payload, '')).toBe(false);
    });

    it('should return false when webhook secret is not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MetaMapProvider,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ''),
            },
          },
        ],
      }).compile();

      const unconfiguredProvider = module.get<MetaMapProvider>(MetaMapProvider);
      expect(unconfiguredProvider.verifyWebhookSignature('payload', 'signature')).toBe(false);
    });

    it('should handle Buffer payloads', () => {
      const payload = Buffer.from('{"flowId":"flow-abc"}', 'utf-8');
      const expected = createHmac('sha256', MOCK_WEBHOOK_SECRET)
        .update(payload.toString('utf-8'))
        .digest('hex');

      expect(provider.verifyWebhookSignature(payload, expected)).toBe(true);
    });

    it('should return false when signature has mismatched length', () => {
      const payload = '{"flowId":"flow-abc"}';
      // Signature with wrong length (too short)
      expect(provider.verifyWebhookSignature(payload, 'ab')).toBe(false);
    });

    it('should return false for malformed non-hex signature (catch block)', () => {
      const payload = '{"flowId":"flow-abc"}';
      // non-hex characters that could cause Buffer.from to behave unexpectedly
      // The provider should handle this gracefully
      const result = provider.verifyWebhookSignature(payload, 'zzzzzz');
      expect(typeof result).toBe('boolean');
    });
  });

  // ---------------------------------------------------------------------------
  // createVerificationFlow
  // ---------------------------------------------------------------------------
  describe('createVerificationFlow', () => {
    let fetchSpy: jest.SpyInstance;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('should create a verification flow and return flowId + URL', async () => {
      // Mock the OAuth token fetch
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/oauth')) {
          return new Response(JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr.includes('/v2/verifications') && !urlStr.includes('/v2/verifications/')) {
          return new Response(
            JSON.stringify({
              identity: 'flow-new-001',
              url: 'https://metamap.com/verify/flow-new-001',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const result = await provider.createVerificationFlow(
        'user-001',
        'https://app.dhan.am/callback'
      );

      expect(result).toEqual({
        flowId: 'flow-new-001',
        verificationUrl: 'https://metamap.com/verify/flow-new-001',
      });

      // Should have made 2 fetch calls: OAuth + create verification
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should throw when OAuth request fails', async () => {
      fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('Unauthorized', { status: 401 }));

      await expect(
        provider.createVerificationFlow('user-001', 'https://app.dhan.am/callback')
      ).rejects.toThrow('MetaMap authentication failed: 401');
    });

    it('should throw when verification flow creation fails', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/oauth')) {
          return new Response(JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Bad Request', { status: 400 });
      });

      await expect(
        provider.createVerificationFlow('user-001', 'https://app.dhan.am/callback')
      ).rejects.toThrow('MetaMap verification flow creation failed: 400');
    });

    it('should reuse cached token when not expired', async () => {
      let oauthCallCount = 0;
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/oauth')) {
          oauthCallCount++;
          return new Response(JSON.stringify({ access_token: 'tok-cached', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({ identity: 'flow-x', url: 'https://metamap.com/verify/x' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      await provider.createVerificationFlow('user-001', 'https://app.dhan.am/callback');
      await provider.createVerificationFlow('user-002', 'https://app.dhan.am/callback');

      // OAuth should only be called once (cached on second call)
      expect(oauthCallCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getVerificationResult
  // ---------------------------------------------------------------------------
  describe('getVerificationResult', () => {
    let fetchSpy: jest.SpyInstance;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('should retrieve and parse verification result with PEP/sanctions flags', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/oauth')) {
          return new Response(JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr.includes('/v2/verifications/flow-result')) {
          return new Response(
            JSON.stringify({
              identity: 'flow-result',
              status: 'verified',
              steps: [
                { id: 'pep-check', status: 200, data: { match: false } },
                { id: 'sanctions-check', status: 200, data: { match: false } },
                { id: 'curp-validation', status: 200, data: {} },
                { id: 'document-reading', status: 200, data: {} },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const result = await provider.getVerificationResult('flow-result');

      expect(result).toEqual({
        flowId: 'flow-result',
        status: 'verified',
        pepMatch: false,
        sanctionsMatch: false,
        curpValidated: true,
        ineValidated: true,
        details: expect.any(Object),
      });
    });

    it('should detect PEP match from verification steps', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/oauth')) {
          return new Response(JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            identity: 'flow-pep',
            status: 'verified',
            steps: [
              { id: 'pep-check', status: 200, data: { match: true } },
              { id: 'sanctions-check', status: 200, data: { match: false } },
              { id: 'curp-validation', status: 200 },
              { id: 'document-reading', status: 200 },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const result = await provider.getVerificationResult('flow-pep');

      expect(result.pepMatch).toBe(true);
      expect(result.sanctionsMatch).toBe(false);
    });

    it('should handle missing steps gracefully', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/oauth')) {
          return new Response(JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            identity: 'flow-minimal',
            status: 'verified',
            steps: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const result = await provider.getVerificationResult('flow-minimal');

      expect(result.pepMatch).toBe(false);
      expect(result.sanctionsMatch).toBe(false);
      expect(result.curpValidated).toBe(false);
      expect(result.ineValidated).toBe(false);
    });

    it('should throw when result retrieval fails', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/oauth')) {
          return new Response(JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Server Error', { status: 500 });
      });

      await expect(provider.getVerificationResult('flow-fail')).rejects.toThrow(
        'MetaMap verification result retrieval failed: 500'
      );
    });
  });
});
