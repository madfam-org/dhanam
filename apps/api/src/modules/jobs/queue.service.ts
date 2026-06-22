import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { Queue, Worker, Job, QueueEvents, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';

import { InfrastructureException } from '@core/exceptions/domain-exceptions';

export interface JobData {
  type: string;
  payload: Record<string, unknown>;
  userId?: string;
  spaceId?: string;
  retryAttempts?: number;
}

export interface DeadLetterJob {
  id: string;
  queue: string;
  name: string;
  data: Record<string, unknown>;
  failedReason: string;
  stacktrace: string[];
  attemptsMade: number;
  maxAttempts: number;
  failedAt: Date;
  processedAt?: Date;
}

export interface FailedQueueJob {
  id: string;
  name: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  timestamp?: string;
  processedOn?: string;
  finishedOn?: string;
}

export interface SyncTransactionsJobData {
  type: 'sync-transactions';
  payload: {
    provider: 'belvo' | 'plaid' | 'bitso';
    userId: string;
    connectionId: string;
    fullSync?: boolean;
  };
}

export interface CategorizeTransactionsJobData {
  type: 'categorize-transactions';
  payload: {
    spaceId: string;
    transactionIds?: string[];
  };
}

export interface ESGUpdateJobData {
  type: 'esg-update';
  payload: {
    symbols: string[];
    forceRefresh?: boolean;
  };
}

export interface ValuationSnapshotJobData {
  type: 'valuation-snapshot';
  payload: {
    spaceId: string;
    date?: string;
  };
}

export interface EmailJobData {
  type: 'send-email';
  payload: {
    to: string;
    template: string;
    data: Record<string, unknown>;
    priority?: 'high' | 'normal' | 'low';
  };
}

export interface ReferralRewardJobData {
  type: 'referral-reward-apply';
  payload: {
    rewardId: string;
    recipientUserId: string;
    rewardType: string;
    referralId: string;
  };
}

export interface PlatformImportJobData {
  type: 'platform-import';
  payload: {
    importJobId: string;
    spaceId: string;
    userId: string;
  };
}

export type QueueJobData =
  | SyncTransactionsJobData
  | CategorizeTransactionsJobData
  | ESGUpdateJobData
  | ValuationSnapshotJobData
  | EmailJobData
  | ReferralRewardJobData
  | PlatformImportJobData;

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private redis: Redis;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private queueEvents = new Map<string, QueueEvents>();
  private deadLetterQueue: Queue | null = null;
  private isShuttingDown = false;

  // Dead letter queue key prefix for Redis storage
  private readonly DLQ_KEY = 'dhanam:dlq:jobs';

  private get bullMqConnection(): ConnectionOptions {
    // BullMQ's public types bind to its own ioredis package identity.
    return this.redis as unknown as ConnectionOptions;
  }

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 5) {
          this.logger.error('Redis connection failed after 5 retries', 'QueueService');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.redis.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`, 'QueueService');
      Sentry.captureException(error, {
        tags: { component: 'queue-service', operation: 'redis-connection' },
      });
    });
  }

  async onModuleInit() {
    try {
      // Only connect if not already connected or connecting
      // ioredis status values: 'wait' | 'reconnecting' | 'connecting' | 'connect' | 'ready' | 'close' | 'end'
      const status = this.redis.status;
      if (status === 'wait') {
        await this.redis.connect();
      } else if (status !== 'ready' && status !== 'connect' && status !== 'connecting') {
        this.logger.warn(`Redis in unexpected state: ${status}, attempting connection...`);
        await this.redis.connect();
      }
      await this.initializeQueues();
      this.logger.log('Queue service initialized successfully');
    } catch (error) {
      // In test environment, gracefully handle connection failures
      const isTestEnv = process.env.NODE_ENV === 'test';
      if (isTestEnv) {
        this.logger.warn('Queue service initialization skipped in test environment:', error);
      } else {
        this.logger.error('Failed to initialize queue service:', error);
      }
    }
  }

  async onModuleDestroy() {
    // Close all workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }

    // Close all queue events
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    await this.redis.disconnect();
    this.logger.log('Queue service shut down');
  }

  private async initializeQueues() {
    const queueNames = [
      'sync-transactions',
      'categorize-transactions',
      'esg-updates',
      'valuation-snapshots',
      'email-notifications',
      'system-maintenance',
      'referral-rewards',
      'platform-import',
    ];

    // Initialize dead letter queue first
    this.deadLetterQueue = new Queue('dead-letter', {
      connection: this.bullMqConnection,
      defaultJobOptions: {
        removeOnComplete: false, // Keep all DLQ jobs for manual review
        removeOnFail: false,
      },
    });

    for (const queueName of queueNames) {
      const maxAttempts = this.getMaxAttemptsForQueue(queueName);
      const queue = new Queue(queueName, {
        connection: this.bullMqConnection,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: maxAttempts,
          backoff:
            queueName === 'referral-rewards'
              ? // Custom backoff resolved on the worker via `referral-reward-backoff`
                // strategy (60s / 5m / 30m). See registerWorker().
                { type: 'referral-reward-backoff' }
              : {
                  type: 'exponential',
                  delay: this.getBackoffDelayForQueue(queueName),
                },
        },
      });

      const queueEvents = new QueueEvents(queueName, {
        connection: this.bullMqConnection,
      });

      this.queues.set(queueName, queue);
      this.queueEvents.set(queueName, queueEvents);

      // Setup queue event listeners with comprehensive error capture
      queueEvents.on('completed', ({ jobId }) => {
        this.logger.log(`Job ${jobId} in queue ${queueName} completed`);
      });

      queueEvents.on('failed', async ({ jobId, failedReason }) => {
        this.logger.error(`Job ${jobId} in queue ${queueName} failed: ${failedReason}`);

        // Capture to Sentry with context
        Sentry.withScope((scope) => {
          scope.setTag('queue', queueName);
          scope.setTag('jobId', jobId);
          scope.setLevel('error');
          scope.setContext('job', {
            queue: queueName,
            jobId,
            failedReason,
          });
          Sentry.captureMessage(`Job failed: ${queueName}/${jobId}`, 'error');
        });

        // Check if this is the final failure and move to DLQ
        await this.handlePotentialDLQJob(queueName, jobId, failedReason);
      });

      queueEvents.on('stalled', ({ jobId }) => {
        this.logger.warn(`Job ${jobId} in queue ${queueName} stalled`);

        Sentry.withScope((scope) => {
          scope.setTag('queue', queueName);
          scope.setTag('jobId', jobId);
          scope.setLevel('warning');
          Sentry.captureMessage(`Job stalled: ${queueName}/${jobId}`, 'warning');
        });
      });

      queueEvents.on('error', (error) => {
        this.logger.error(`Queue event error in ${queueName}: ${error.message}`);
        Sentry.captureException(error, {
          tags: { component: 'queue-events', queue: queueName },
        });
      });
    }
  }

  /**
   * Get max retry attempts based on queue criticality
   */
  private getMaxAttemptsForQueue(queueName: string): number {
    const criticalQueues = ['sync-transactions', 'email-notifications'];
    const highPriorityQueues = ['categorize-transactions', 'valuation-snapshots'];

    if (criticalQueues.includes(queueName)) {
      return 5; // More retries for critical operations
    }
    if (highPriorityQueues.includes(queueName)) {
      return 4;
    }
    if (queueName === 'referral-rewards') {
      // Initial try + 3 retries (1m / 5m / 30m). Total: 4 BullMQ
      // attempts. Tied to the `referral-reward-backoff` worker strategy.
      return 4;
    }
    return 3; // Default
  }

  /**
   * Custom backoff schedule for the referral-rewards queue.
   *
   * Per BullMQ source (`bullmq/classes/job.js`), the strategy is called with
   * `attemptsMade + 1` after a failure — i.e. the 1-indexed number of the
   * upcoming retry. With `attempts: 4` (initial + 3 retries) the audit's
   * requested 1m / 5m / 30m schedule maps to:
   *   - 2 (before retry #2): wait 1 minute
   *   - 3 (before retry #3): wait 5 minutes
   *   - 4 (before retry #4): wait 30 minutes
   *
   * After the final failure the job exits to BullMQ's `failed` set, where
   * `handlePotentialDLQJob()` moves it to the dead letter queue.
   *
   * Exported as a static helper so the worker registration in
   * `registerWorker()` and unit tests can both reference the same
   * authoritative schedule.
   */
  static referralRewardBackoff(upcomingAttempt: number): number {
    const minute = 60_000;
    if (upcomingAttempt <= 2) return 1 * minute;
    if (upcomingAttempt === 3) return 5 * minute;
    return 30 * minute;
  }

  /**
   * Get backoff delay based on queue type
   */
  private getBackoffDelayForQueue(queueName: string): number {
    // External API calls need longer delays to respect rate limits
    if (queueName === 'sync-transactions') {
      return 10000; // 10s initial delay for provider syncs
    }
    if (queueName === 'email-notifications') {
      return 5000; // 5s for email
    }
    return 3000; // 3s default
  }

  /**
   * Handle jobs that have exhausted all retries - move to dead letter queue
   */
  private async handlePotentialDLQJob(
    queueName: string,
    jobId: string,
    failedReason: string
  ): Promise<void> {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) return;

      const job = await queue.getJob(jobId);
      if (!job) return;

      const maxAttempts = job.opts.attempts || this.getMaxAttemptsForQueue(queueName);
      const attemptsMade = job.attemptsMade;

      // Only move to DLQ if all retries exhausted
      if (attemptsMade >= maxAttempts) {
        await this.moveToDeadLetterQueue(job, queueName, failedReason);
      }
    } catch (error) {
      this.logger.error(`Failed to handle DLQ for job ${jobId}: ${(error as Error).message}`);
    }
  }

  /**
   * Move a failed job to the dead letter queue for manual review
   */
  private async moveToDeadLetterQueue(
    job: Job,
    queueName: string,
    failedReason: string
  ): Promise<void> {
    if (!this.deadLetterQueue) return;

    const dlqJob: DeadLetterJob = {
      id: job.id || 'unknown',
      queue: queueName,
      name: job.name,
      data: job.data,
      failedReason,
      stacktrace: job.stacktrace || [],
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts || 3,
      failedAt: new Date(),
    };

    // Store in DLQ Redis list for persistence
    await this.redis.lpush(this.DLQ_KEY, JSON.stringify(dlqJob));

    // Also add to DLQ queue for visibility
    await this.deadLetterQueue.add('failed-job', dlqJob, {
      jobId: `dlq-${queueName}-${job.id}-${Date.now()}`,
    });

    this.logger.warn(
      `Job ${job.id} from ${queueName} moved to dead letter queue after ${job.attemptsMade} attempts`
    );

    // Capture comprehensive error to Sentry
    Sentry.withScope((scope) => {
      scope.setTag('dlq', 'true');
      scope.setTag('queue', queueName);
      scope.setTag('jobId', job.id || 'unknown');
      scope.setLevel('error');
      scope.setContext('deadLetterJob', {
        originalQueue: queueName,
        jobName: job.name,
        jobData: job.data,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        failedReason,
      });
      scope.setExtra('stacktrace', job.stacktrace);
      Sentry.captureMessage(`Job exhausted all retries: ${queueName}/${job.name}`, 'error');
    });
  }

  // Helper method to check queue availability
  private getQueueOrSkip(queueName: string): Queue | null {
    const queue = this.queues.get(queueName);
    if (!queue) {
      const isTestEnv = process.env.NODE_ENV === 'test';
      if (isTestEnv) {
        this.logger.warn(`Queue ${queueName} not initialized, skipping job in test environment`);
        return null;
      }
      throw new Error(`Queue ${queueName} not initialized`);
    }
    return queue;
  }

  // Job scheduling methods
  async addSyncTransactionsJob(
    data: SyncTransactionsJobData['payload'],
    priority: number = 50,
    delay: number = 0,
    jobId?: string
  ): Promise<Job | null> {
    const queue = this.getQueueOrSkip('sync-transactions');
    if (!queue) return null;

    return queue.add('sync-transactions', data, {
      priority,
      delay,
      jobId: jobId ?? `sync-${data.provider}-${data.userId}-${Date.now()}`,
    });
  }

  async addCategorizeTransactionsJob(
    data: CategorizeTransactionsJobData['payload'],
    priority: number = 30,
    jobId?: string
  ): Promise<Job | null> {
    const queue = this.getQueueOrSkip('categorize-transactions');
    if (!queue) return null;

    return queue.add('categorize-transactions', data, {
      priority,
      jobId: jobId ?? `categorize-${data.spaceId}-${Date.now()}`,
    });
  }

  async addESGUpdateJob(
    data: ESGUpdateJobData['payload'],
    priority: number = 20,
    jobId?: string
  ): Promise<Job | null> {
    const queue = this.getQueueOrSkip('esg-updates');
    if (!queue) return null;

    return queue.add('esg-update', data, {
      priority,
      jobId: jobId ?? `esg-${data.symbols.join('-')}-${Date.now()}`,
    });
  }

  async addValuationSnapshotJob(
    data: ValuationSnapshotJobData['payload'],
    priority: number = 10
  ): Promise<Job | null> {
    const queue = this.getQueueOrSkip('valuation-snapshots');
    if (!queue) return null;

    return queue.add('valuation-snapshot', data, {
      priority,
      jobId: `snapshot-${data.spaceId}-${data.date || new Date().toISOString().split('T')[0]}`,
    });
  }

  async addEmailJob(data: EmailJobData['payload'], priority: number = 40): Promise<Job | null> {
    const queue = this.getQueueOrSkip('email-notifications');
    if (!queue) return null;

    const jobPriority = data.priority === 'high' ? 80 : data.priority === 'low' ? 10 : priority;

    return queue.add('send-email', data, {
      priority: jobPriority,
      jobId: `email-${data.to}-${Date.now()}`,
    });
  }

  /**
   * Enqueue a referral reward application job.
   *
   * Idempotency: jobId is the reward id, so a second webhook delivering the
   * same reward (or a retry from PhyndCRM) cannot create a duplicate job
   * — BullMQ silently no-ops the second `add()`.
   *
   * Retry policy is queue-level (3 attempts, 1m / 5m / 30m custom backoff).
   * Final failures fall through to QueueService's existing dead letter
   * queue handling.
   */
  async addReferralRewardJob(
    data: ReferralRewardJobData['payload'],
    priority: number = 60
  ): Promise<Job | null> {
    const queue = this.getQueueOrSkip('referral-rewards');
    if (!queue) return null;

    return queue.add('referral-reward-apply', data, {
      priority,
      jobId: data.rewardId,
    });
  }

  async addPlatformImportJob(
    data: PlatformImportJobData['payload'],
    priority: number = 40
  ): Promise<Job | null> {
    const queue = this.getQueueOrSkip('platform-import');
    if (!queue) return null;

    return queue.add('platform-import', data, {
      priority,
      jobId: data.importJobId,
    });
  }

  // Recurring job scheduling
  async scheduleRecurringJob(
    queueName: string,
    jobName: string,
    data: Record<string, unknown>,
    cronPattern: string
  ): Promise<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      // In test environment, gracefully skip scheduling
      const isTestEnv = process.env.NODE_ENV === 'test';
      if (isTestEnv) {
        this.logger.warn(`Queue ${queueName} not initialized, skipping recurring job ${jobName}`);
        return null;
      }
      throw new Error(`Queue ${queueName} not initialized`);
    }

    return queue.add(jobName, data, {
      repeat: { pattern: cronPattern },
      jobId: `recurring-${jobName}`,
    });
  }

  async removeRecurringJob(
    queueName: string,
    jobName: string,
    cronPattern: string,
    jobId: string = `recurring-${jobName}`
  ): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      const isTestEnv = process.env.NODE_ENV === 'test';
      if (isTestEnv) {
        this.logger.warn(`Queue ${queueName} not initialized, skipping recurring job cleanup`);
        return false;
      }
      throw new Error(`Queue ${queueName} not initialized`);
    }

    let removed = false;

    try {
      removed = await queue.removeRepeatable(jobName, { pattern: cronPattern }, jobId);
    } catch (error) {
      this.logger.warn(
        `Legacy recurring job cleanup failed for ${queueName}/${jobName}: ${(error as Error).message}`
      );
    }

    try {
      const schedulerRemoved = await queue.removeJobScheduler(jobId);
      removed = removed || schedulerRemoved;
    } catch (error) {
      this.logger.warn(
        `Job scheduler cleanup failed for ${queueName}/${jobName}: ${(error as Error).message}`
      );
    }

    if (removed) {
      this.logger.log(`Removed recurring job ${queueName}/${jobName}`);
    }

    return removed;
  }

  // Queue management
  async getQueueStats(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      name: queueName,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async getAllQueueStats() {
    const queueNames = Array.from(this.queues.keys());
    return Promise.all(queueNames.map((name) => this.getQueueStats(name)));
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.pause();
    this.logger.log(`Queue ${queueName} paused`);
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.resume();
    this.logger.log(`Queue ${queueName} resumed`);
  }

  async clearQueue(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const stats = await this.getQueueStats(queueName);
    const clearedCount =
      stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed;

    await queue.obliterate({ force: true });
    this.logger.log(`Queue ${queueName} cleared (${clearedCount} jobs removed)`);
    return clearedCount;
  }

  async getFailedJobs(queueName: string, limit = 25): Promise<FailedQueueJob[]> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const failedJobs = await queue.getFailed(0, normalizedLimit - 1);

    return failedJobs.map((job) => ({
      id: String(job.id ?? ''),
      name: job.name,
      data: this.redactJobData(job.data),
      failedReason: job.failedReason ?? '',
      attemptsMade: job.attemptsMade,
      timestamp: this.toIsoTimestamp(job.timestamp),
      processedOn: this.toIsoTimestamp(job.processedOn),
      finishedOn: this.toIsoTimestamp(job.finishedOn),
    }));
  }

  async clearFailedJobs(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const failedJobs = await queue.getFailed();

    for (const job of failedJobs) {
      await job.remove();
    }

    this.logger.log(`Cleared ${failedJobs.length} failed jobs in queue ${queueName}`);
    return failedJobs.length;
  }

  async retryFailedJobs(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const failedJobs = await queue.getFailed();

    for (const job of failedJobs) {
      await job.retry();
    }

    this.logger.log(`Retried ${failedJobs.length} failed jobs in queue ${queueName}`);
    return failedJobs.length;
  }

  private redactJobData(value: unknown, depth = 0): unknown {
    if (depth > 5) {
      return '[MaxDepth]';
    }

    if (Array.isArray(value)) {
      return value.slice(0, 50).map((item) => this.redactJobData(item, depth + 1));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
          key,
          this.isSensitiveJobDataKey(key)
            ? '[REDACTED]'
            : this.redactJobData(nestedValue, depth + 1),
        ])
      );
    }

    if (typeof value === 'string' && value.length > 500) {
      return `${value.slice(0, 500)}...`;
    }

    return value;
  }

  private isSensitiveJobDataKey(key: string): boolean {
    return /token|secret|password|credential|authorization|cookie|session|api[_-]?key/i.test(key);
  }

  private toIsoTimestamp(value?: number): string | undefined {
    return typeof value === 'number' && Number.isFinite(value)
      ? new Date(value).toISOString()
      : undefined;
  }

  registerWorker(queueName: string, processor: (job: Job) => Promise<any>): Worker {
    const workerOptions: ConstructorParameters<typeof Worker>[2] = {
      connection: this.bullMqConnection,
      concurrency: this.configService.get(
        `QUEUE_${queueName.toUpperCase().replace('-', '_')}_CONCURRENCY`,
        5
      ),
    };

    // Register custom backoff strategies. BullMQ resolves
    // `backoff.type === 'referral-reward-backoff'` against this map at
    // failure time on the worker side.
    if (queueName === 'referral-rewards') {
      workerOptions.settings = {
        backoffStrategy: (attemptsMade: number) => QueueService.referralRewardBackoff(attemptsMade),
      };
    }

    const worker = new Worker(queueName, processor, workerOptions);

    worker.on('completed', (job) => {
      this.logger.log(`Worker completed job ${job.id} in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Worker failed job ${job?.id} in queue ${queueName}: ${err.message}`);
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker error in queue ${queueName}: ${err.message}`);
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Worker registered for queue ${queueName}`);

    return worker;
  }

  /**
   * Check if the service is accepting new jobs
   */
  isAcceptingJobs(): boolean {
    return !this.isShuttingDown;
  }

  /**
   * Gracefully drain all queues during shutdown
   * Stops accepting new jobs and waits for active jobs to complete
   * @param timeoutMs - Maximum time to wait for jobs to complete (default: 30s)
   */
  async drainQueues(timeoutMs = 30000): Promise<void> {
    this.isShuttingDown = true;
    this.logger.log('Starting queue drain process...');

    // Pause all queues to stop accepting new jobs
    for (const [queueName, queue] of this.queues) {
      try {
        await queue.pause();
        this.logger.log(`Queue ${queueName} paused`);
      } catch (error) {
        this.logger.warn(`Failed to pause queue ${queueName}:`, error);
      }
    }

    // Wait for active jobs to complete with timeout
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second

    while (Date.now() - startTime < timeoutMs) {
      let totalActive = 0;

      for (const [queueName, queue] of this.queues) {
        try {
          const active = await queue.getActive();
          totalActive += active.length;
          if (active.length > 0) {
            this.logger.debug(`Queue ${queueName}: ${active.length} active jobs`);
          }
        } catch (error) {
          this.logger.warn(`Failed to get active jobs for ${queueName}:`, error);
        }
      }

      if (totalActive === 0) {
        this.logger.log('All active jobs completed');
        break;
      }

      this.logger.log(`Waiting for ${totalActive} active jobs to complete...`);
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // Check if we timed out
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeoutMs) {
      this.logger.warn(`Queue drain timed out after ${timeoutMs}ms`);

      // Log remaining jobs for visibility
      for (const [queueName, queue] of this.queues) {
        try {
          const active = await queue.getActive();
          if (active.length > 0) {
            this.logger.warn(
              `Queue ${queueName} still has ${active.length} active jobs that will be interrupted`
            );
          }
        } catch {
          // Ignore errors during final check
        }
      }
    }

    this.logger.log(`Queue drain completed in ${elapsed}ms`);
  }

  /**
   * Get the count of active jobs across all queues
   */
  async getActiveJobCount(): Promise<number> {
    let totalActive = 0;
    for (const queue of this.queues.values()) {
      try {
        const active = await queue.getActive();
        totalActive += active.length;
      } catch {
        // Ignore errors
      }
    }
    return totalActive;
  }

  // ============ Dead Letter Queue Management ============

  /**
   * Get all jobs in the dead letter queue
   */
  async getDeadLetterJobs(limit = 100): Promise<DeadLetterJob[]> {
    try {
      const jobs = await this.redis.lrange(this.DLQ_KEY, 0, limit - 1);
      return jobs.map((job) => JSON.parse(job) as DeadLetterJob);
    } catch (error) {
      this.logger.error(`Failed to get DLQ jobs: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Get dead letter queue statistics
   */
  async getDeadLetterQueueStats(): Promise<{
    total: number;
    byQueue: Record<string, number>;
    oldestJob: Date | null;
    newestJob: Date | null;
  }> {
    const jobs = await this.getDeadLetterJobs(1000);

    const byQueue: Record<string, number> = {};
    let oldestJob: Date | null = null;
    let newestJob: Date | null = null;

    for (const job of jobs) {
      byQueue[job.queue] = (byQueue[job.queue] || 0) + 1;

      const failedAt = new Date(job.failedAt);
      if (!oldestJob || failedAt < oldestJob) oldestJob = failedAt;
      if (!newestJob || failedAt > newestJob) newestJob = failedAt;
    }

    return {
      total: jobs.length,
      byQueue,
      oldestJob,
      newestJob,
    };
  }

  /**
   * Retry a specific job from the dead letter queue
   */
  async retryDeadLetterJob(dlqJobId: string): Promise<boolean> {
    try {
      const jobs = await this.getDeadLetterJobs(1000);
      const dlqJob = jobs.find((j) => j.id === dlqJobId);

      if (!dlqJob) {
        this.logger.warn(`DLQ job ${dlqJobId} not found`);
        return false;
      }

      const queue = this.queues.get(dlqJob.queue);
      if (!queue) {
        throw InfrastructureException.queueError(
          'retry_dlq',
          new Error(`Queue ${dlqJob.queue} not found`)
        );
      }

      // Re-add the job to its original queue
      await queue.add(dlqJob.name, dlqJob.data, {
        jobId: `retry-${dlqJob.id}-${Date.now()}`,
      });

      // Remove from DLQ Redis list
      await this.redis.lrem(this.DLQ_KEY, 1, JSON.stringify(dlqJob));

      // Mark as processed in DLQ queue
      dlqJob.processedAt = new Date();
      this.logger.log(`Retried DLQ job ${dlqJobId} from queue ${dlqJob.queue}`);

      return true;
    } catch (error) {
      this.logger.error(`Failed to retry DLQ job ${dlqJobId}: ${(error as Error).message}`);
      Sentry.captureException(error, {
        tags: { component: 'queue-service', operation: 'retry-dlq' },
        extra: { dlqJobId },
      });
      return false;
    }
  }

  /**
   * Retry all jobs from the dead letter queue for a specific original queue
   */
  async retryDeadLetterQueueByOriginalQueue(queueName: string): Promise<{
    retried: number;
    failed: number;
  }> {
    const jobs = await this.getDeadLetterJobs(1000);
    const queueJobs = jobs.filter((j) => j.queue === queueName);

    let retried = 0;
    let failed = 0;

    for (const job of queueJobs) {
      const success = await this.retryDeadLetterJob(job.id);
      if (success) {
        retried++;
      } else {
        failed++;
      }
    }

    this.logger.log(`Retried ${retried}/${queueJobs.length} DLQ jobs from queue ${queueName}`);
    return { retried, failed };
  }

  /**
   * Clear all jobs from the dead letter queue
   */
  async clearDeadLetterQueue(): Promise<number> {
    try {
      const count = await this.redis.llen(this.DLQ_KEY);
      await this.redis.del(this.DLQ_KEY);

      if (this.deadLetterQueue) {
        await this.deadLetterQueue.obliterate({ force: true });
      }

      this.logger.log(`Cleared ${count} jobs from dead letter queue`);
      return count;
    } catch (error) {
      this.logger.error(`Failed to clear DLQ: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Remove old jobs from the dead letter queue (older than specified days)
   */
  async pruneDeadLetterQueue(olderThanDays = 30): Promise<number> {
    try {
      const jobs = await this.getDeadLetterJobs(10000);
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      let removed = 0;
      for (const job of jobs) {
        const failedAt = new Date(job.failedAt);
        if (failedAt < cutoffDate) {
          await this.redis.lrem(this.DLQ_KEY, 1, JSON.stringify(job));
          removed++;
        }
      }

      this.logger.log(`Pruned ${removed} old jobs from dead letter queue`);
      return removed;
    } catch (error) {
      this.logger.error(`Failed to prune DLQ: ${(error as Error).message}`);
      return 0;
    }
  }
}
