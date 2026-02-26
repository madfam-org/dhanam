/** Base error for all Dhanam SDK errors */
export class DhanamApiError extends Error {
  public readonly status: number;
  public readonly code: string | undefined;
  public readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'DhanamApiError';
    this.status = status;
    this.body = body;

    // Extract error code from structured API responses
    if (body && typeof body === 'object' && 'code' in body) {
      this.code = (body as Record<string, unknown>).code as string;
    }
  }
}

/** Thrown when authentication fails (401) or token is missing */
export class DhanamAuthError extends DhanamApiError {
  constructor(message = 'Authentication failed', body?: unknown) {
    super(message, 401, body);
    this.name = 'DhanamAuthError';
  }
}
