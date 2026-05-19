import { PrismaClientKnownRequestError } from '@db';

/**
 * Creates an operation that fails N times then succeeds
 */
export function createFailingOperation<T>(failCount: number, successValue: T): () => Promise<T> {
  let calls = 0;
  return async () => {
    calls++;
    if (calls <= failCount) {
      throw new Error(`Simulated failure ${calls}/${failCount}`);
    }
    return successValue;
  };
}

/**
 * Creates a network error with specific code
 */
export function createNetworkError(
  code: 'ECONNRESET' | 'ETIMEDOUT' | 'ECONNREFUSED' | 'ENOTFOUND' | 'ENETUNREACH'
): Error {
  const error = new Error(`connect ${code}`);
  (error as any).code = code;
  return error;
}

/**
 * Creates a Prisma known request error
 */
export function createPrismaError(
  code: string,
  meta?: Record<string, unknown>
): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: '6.1.0',
    meta,
  });
}

/**
 * Creates a slow operation that resolves after a delay
 */
export function createSlowOperation<T>(delayMs: number, result?: T): () => Promise<T> {
  return () =>
    new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(result as T), delayMs);
      timeout.unref?.();
    });
}

/**
 * Creates an operation that can be controlled externally
 */
export function createControllableOperation<T>(): {
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolveRef: (value: T) => void;
  let rejectRef: (error: Error) => void;

  const operation = () =>
    new Promise<T>((resolve, reject) => {
      resolveRef = resolve;
      rejectRef = reject;
    });

  return {
    operation,
    resolve: (value: T) => resolveRef(value),
    reject: (error: Error) => rejectRef(error),
  };
}

/**
 * Creates an auth error (non-retryable)
 */
export function createAuthError(provider: string): Error {
  const error = new Error(`Authentication with ${provider} failed: invalid credentials`);
  (error as any).code = 'AUTH_FAILED';
  return error;
}

/**
 * Tracks call count and arguments for a mock function
 */
export function createCallTracker<T extends (...args: any[]) => any>() {
  const calls: Parameters<T>[] = [];
  return {
    calls,
    fn: ((...args: any[]) => {
      calls.push(args as Parameters<T>);
    }) as unknown as T,
    get callCount() {
      return calls.length;
    },
  };
}
