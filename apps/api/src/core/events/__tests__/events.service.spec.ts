import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, take, toArray } from 'rxjs';

import { EventsService, RealtimeEventType, SseMessage } from '../events.service';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsService],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  afterEach(() => {
    // Clean up any open streams
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe', () => {
    it('should return an observable', () => {
      const obs = service.subscribe('user-1');
      expect(obs).toBeDefined();
      expect(typeof obs.subscribe).toBe('function');
    });

    it('should track active connections', () => {
      expect(service.getActiveConnectionCount()).toBe(0);

      service.subscribe('user-1');
      expect(service.getActiveConnectionCount()).toBe(1);

      service.subscribe('user-2');
      expect(service.getActiveConnectionCount()).toBe(2);
    });

    it('should reuse existing stream for the same user', () => {
      service.subscribe('user-1');
      service.subscribe('user-1');
      expect(service.getActiveConnectionCount()).toBe(1);
    });
  });

  describe('emit', () => {
    it('should deliver event to subscribed user', async () => {
      const received: SseMessage[] = [];
      const obs = service.subscribe('user-1');
      const promise = firstValueFrom(obs.pipe(take(1)));

      // Small delay to ensure subscription is established
      await new Promise((resolve) => setTimeout(resolve, 10));

      service.emit('user-1', 'sync.complete', {
        provider: 'plaid',
        accountId: 'acc-1',
      });

      const msg = await promise;
      expect(msg).toBeDefined();
      expect(msg.type).toBe('sync.complete');
      expect(msg.id).toContain('user-1');

      const parsed = JSON.parse(msg.data);
      expect(parsed.type).toBe('sync.complete');
      expect(parsed.data.provider).toBe('plaid');
      expect(parsed.data.accountId).toBe('acc-1');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should not throw when emitting to user with no active stream', () => {
      expect(() => {
        service.emit('no-such-user', 'balance.updated', { balance: 100 });
      }).not.toThrow();
    });

    it('should deliver multiple events in order', async () => {
      const obs = service.subscribe('user-1');
      const promise = firstValueFrom(obs.pipe(take(3), toArray()));

      await new Promise((resolve) => setTimeout(resolve, 10));

      service.emit('user-1', 'sync.complete', { seq: 1 });
      service.emit('user-1', 'balance.updated', { seq: 2 });
      service.emit('user-1', 'transaction.new', { seq: 3 });

      const messages = await promise;
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('sync.complete');
      expect(messages[1].type).toBe('balance.updated');
      expect(messages[2].type).toBe('transaction.new');
    });

    it('should only deliver events to the target user', async () => {
      const user1Messages: SseMessage[] = [];
      const user2Messages: SseMessage[] = [];

      const obs1 = service.subscribe('user-1');
      const obs2 = service.subscribe('user-2');

      const sub1 = obs1.subscribe((msg) => user1Messages.push(msg));
      const sub2 = obs2.subscribe((msg) => user2Messages.push(msg));

      await new Promise((resolve) => setTimeout(resolve, 10));

      service.emit('user-1', 'sync.complete', { target: 'user-1' });
      service.emit('user-2', 'balance.updated', { target: 'user-2' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(user1Messages).toHaveLength(1);
      expect(user1Messages[0].type).toBe('sync.complete');

      expect(user2Messages).toHaveLength(1);
      expect(user2Messages[0].type).toBe('balance.updated');

      sub1.unsubscribe();
      sub2.unsubscribe();
    });
  });

  describe('SseMessage format', () => {
    it('should include retry field for client reconnection', async () => {
      const obs = service.subscribe('user-1');
      const promise = firstValueFrom(obs.pipe(take(1)));

      await new Promise((resolve) => setTimeout(resolve, 10));
      service.emit('user-1', 'budget.alert', { budgetId: 'b-1' });

      const msg = await promise;
      expect(msg.retry).toBe(15_000);
    });

    it('should include event type field', async () => {
      const obs = service.subscribe('user-1');
      const promise = firstValueFrom(obs.pipe(take(1)));

      await new Promise((resolve) => setTimeout(resolve, 10));
      service.emit('user-1', 'transaction.new', { txId: 'tx-1' });

      const msg = await promise;
      expect(msg.type).toBe('transaction.new');
    });
  });

  describe('getActiveConnectionCount', () => {
    it('should return 0 when no connections exist', () => {
      expect(service.getActiveConnectionCount()).toBe(0);
    });
  });

  describe('onModuleDestroy', () => {
    it('should close all streams and reset count', () => {
      service.subscribe('user-1');
      service.subscribe('user-2');
      expect(service.getActiveConnectionCount()).toBe(2);

      service.onModuleDestroy();
      expect(service.getActiveConnectionCount()).toBe(0);
    });

    it('should complete all observables', (done) => {
      const obs = service.subscribe('user-1');
      obs.subscribe({
        complete: () => {
          done();
        },
      });

      service.onModuleDestroy();
    });
  });
});
