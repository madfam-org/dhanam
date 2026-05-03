import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';

import { useAuth } from '@/lib/hooks/use-auth';

/**
 * Event types received from the SSE stream.
 * Must stay in sync with RealtimeEventType on the API side.
 */
type RealtimeEventType = 'sync.complete' | 'balance.updated' | 'transaction.new' | 'budget.alert';

interface RealtimePayload {
  type: RealtimeEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Options for the useRealtime hook.
 */
interface UseRealtimeOptions {
  /** Whether the hook should connect.  Defaults to true. */
  enabled?: boolean;
  /** Called on every event, regardless of type. */
  onEvent?: (event: RealtimePayload) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010';

/** Maximum back-off delay between reconnection attempts (30 s). */
const MAX_RECONNECT_DELAY_MS = 30_000;
/** Base delay for exponential back-off (1 s). */
const BASE_RECONNECT_DELAY_MS = 1_000;

/**
 * useRealtime
 *
 * Establishes an SSE connection to GET /v1/events/stream and
 * automatically invalidates React Query caches when the backend
 * pushes real-time events after provider syncs, balance changes,
 * new transactions, or budget alerts.
 *
 * ## Authentication
 * Uses a fetch-based SSE implementation (via EventSource) with the
 * JWT token passed as a query parameter since the native EventSource
 * API does not support custom headers.
 *
 * ## Reconnection
 * On disconnect the hook retries with exponential back-off
 * (1 s, 2 s, 4 s, ... capped at 30 s).  The retry counter resets
 * after a successful connection.
 *
 * ## Cache invalidation mapping
 * | Event            | Invalidated query keys           |
 * |------------------|----------------------------------|
 * | sync.complete    | accounts, transactions, networth |
 * | balance.updated  | accounts, networth               |
 * | transaction.new  | transactions, accounts           |
 * | budget.alert     | budgets                          |
 *
 * @example
 * ```tsx
 * function DashboardLayout({ children }) {
 *   useRealtime(); // connect once at the layout level
 *   return <>{children}</>;
 * }
 * ```
 */
export function useRealtime(options: UseRealtimeOptions = {}): void {
  const { enabled = true, onEvent } = options;
  const queryClient = useQueryClient();
  const { token, isAuthenticated } = useAuth();

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidateForEvent = useCallback(
    (type: RealtimeEventType) => {
      switch (type) {
        case 'sync.complete':
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['networth'] });
          break;

        case 'balance.updated':
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          queryClient.invalidateQueries({ queryKey: ['networth'] });
          break;

        case 'transaction.new':
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          break;

        case 'budget.alert':
          queryClient.invalidateQueries({ queryKey: ['budgets'] });
          break;
      }
    },
    [queryClient]
  );

  const connect = useCallback(() => {
    if (!token) return;

    // Close any existing connection before opening a new one
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `${API_BASE_URL}/v1/events/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      // Reset retry counter on successful connection
      retryCountRef.current = 0;
    };

    // Listen for typed events (the backend sets `event: sync.complete` etc.)
    const eventTypes: RealtimeEventType[] = [
      'sync.complete',
      'balance.updated',
      'transaction.new',
      'budget.alert',
    ];

    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const payload: RealtimePayload = JSON.parse(e.data);
          invalidateForEvent(payload.type);
          onEvent?.(payload);
        } catch {
          // Malformed payload — ignore
        }
      });
    }

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      scheduleReconnectRef.current();
    };
  }, [token, invalidateForEvent, onEvent]);

  const scheduleReconnectRef = useRef(() => {});
  const scheduleReconnect = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, retryCountRef.current),
      MAX_RECONNECT_DELAY_MS
    );
    retryCountRef.current += 1;

    retryTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);
  scheduleReconnectRef.current = scheduleReconnect;

  useEffect(() => {
    if (!enabled || !isAuthenticated || !token) {
      // Tear down if disabled or logged out
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [enabled, isAuthenticated, token, connect]);
}
