import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Belvo from 'belvo';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';

export interface IntegrationStatus {
  name: string;
  enabled: boolean;
  configured: boolean;
  environment: string;
  lastSync?: Date;
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly configService: ConfigService) {}

  async getStatus(): Promise<{
    integrations: IntegrationStatus[];
    summary: {
      total: number;
      enabled: number;
      configured: number;
    };
  }> {
    const integrations: IntegrationStatus[] = [
      {
        name: 'Belvo',
        enabled: this.isBelvoEnabled(),
        configured: this.isBelvoConfigured(),
        environment: this.configService.get('BELVO_ENV', 'sandbox'),
      },
      {
        name: 'Plaid',
        enabled: this.isPlaidEnabled(),
        configured: this.isPlaidConfigured(),
        environment: this.configService.get('PLAID_ENV', 'sandbox'),
      },
      {
        name: 'Bitso',
        enabled: this.isBitsoEnabled(),
        configured: this.isBitsoConfigured(),
        environment: 'production',
      },
    ];

    const summary = {
      total: integrations.length,
      enabled: integrations.filter((i) => i.enabled).length,
      configured: integrations.filter((i) => i.configured).length,
    };

    return { integrations, summary };
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    integrations: Array<{
      name: string;
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    }>;
  }> {
    const integrationHealth = await Promise.allSettled([
      this.checkBelvoHealth(),
      this.checkPlaidHealth(),
      this.checkBitsoHealth(),
    ]);

    const results = integrationHealth.map((result, index) => {
      const names = ['Belvo', 'Plaid', 'Bitso'];
      if (result.status === 'fulfilled') {
        return {
          name: names[index]!,
          status: 'healthy' as const,
          latency: result.value.latency,
        };
      } else {
        return {
          name: names[index]!,
          status: 'unhealthy' as const,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    const healthyCount = results.filter((r) => r.status === 'healthy').length;
    const overallStatus =
      healthyCount === results.length ? 'healthy' : healthyCount > 0 ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      integrations: results,
    };
  }

  private isBelvoEnabled(): boolean {
    return this.configService.get('NODE_ENV') !== 'production' || this.isBelvoConfigured();
  }

  private isBelvoConfigured(): boolean {
    return !!(
      this.configService.get('BELVO_SECRET_KEY_ID') &&
      this.configService.get('BELVO_SECRET_KEY_PASSWORD')
    );
  }

  private isPlaidEnabled(): boolean {
    return this.configService.get('NODE_ENV') !== 'production' || this.isPlaidConfigured();
  }

  private isPlaidConfigured(): boolean {
    return !!(this.configService.get('PLAID_CLIENT_ID') && this.configService.get('PLAID_SECRET'));
  }

  private isBitsoEnabled(): boolean {
    return this.configService.get('NODE_ENV') !== 'production' || this.isBitsoConfigured();
  }

  private isBitsoConfigured(): boolean {
    return !!(
      this.configService.get('BITSO_API_KEY') && this.configService.get('BITSO_API_SECRET')
    );
  }

  private async checkBelvoHealth(): Promise<{ latency: number }> {
    const start = Date.now();
    try {
      if (!this.isBelvoConfigured()) {
        throw new Error('Belvo not configured');
      }

      const client = new Belvo(
        this.configService.get('BELVO_SECRET_KEY_ID'),
        this.configService.get('BELVO_SECRET_KEY_PASSWORD'),
        this.configService.get('BELVO_ENV', 'sandbox')
      );

      // Simple health check - list institutions (lightweight operation)
      await client.institutions.list();
      return { latency: Date.now() - start };
    } catch (error) {
      throw new Error(`Belvo health check failed: ${(error as Error).message}`, { cause: error });
    }
  }

  private async checkPlaidHealth(): Promise<{ latency: number }> {
    const start = Date.now();
    try {
      if (!this.isPlaidConfigured()) {
        throw new Error('Plaid not configured');
      }

      const configuration = new Configuration({
        basePath: PlaidEnvironments[this.configService.get('PLAID_ENV', 'sandbox')],
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': this.configService.get('PLAID_CLIENT_ID'),
            'PLAID-SECRET': this.configService.get('PLAID_SECRET'),
          },
        },
      });

      const client = new PlaidApi(configuration);
      await client.categoriesGet({});
      return { latency: Date.now() - start };
    } catch (error) {
      throw new Error(`Plaid health check failed: ${(error as Error).message}`, { cause: error });
    }
  }

  private async checkBitsoHealth(): Promise<{ latency: number }> {
    const start = Date.now();
    try {
      // Public endpoint that doesn't require authentication
      await axios.get('https://api.bitso.com/v3/ticker', { timeout: 5000 });
      return { latency: Date.now() - start };
    } catch (error) {
      throw new Error(`Bitso health check failed: ${(error as Error).message}`, { cause: error });
    }
  }
}
