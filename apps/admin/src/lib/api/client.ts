export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private baseUrl: string;
  private accessToken?: string;
  private onTokenRefresh?: (tokens: { accessToken: string }) => void;

  constructor(config: {
    baseUrl?: string;
    onTokenRefresh?: (tokens: { accessToken: string }) => void;
  }) {
    this.baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_API_URL || 'https://api.dhan.am/v1';
    this.onTokenRefresh = config.onTokenRefresh;
  }

  setTokens(tokens: { accessToken: string }) {
    this.accessToken = tokens.accessToken;
  }

  clearTokens() {
    this.accessToken = undefined;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          response.status,
          data.error?.code || 'UNKNOWN_ERROR',
          data.error?.message || 'An error occurred',
          data.error?.details
        );
      }

      if (
        data &&
        typeof data === 'object' &&
        'data' in data &&
        'meta' in data &&
        Array.isArray((data as { data?: unknown }).data)
      ) {
        return data;
      }

      return data.data || data;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          try {
            const tokens = await this.refreshTokens();
            this.accessToken = tokens.accessToken;
            this.onTokenRefresh?.(tokens);

            return this.request<T>(path, options);
          } catch (refreshError) {
            this.clearTokens();
            throw refreshError;
          }
        }
        throw error;
      }
      throw new ApiError(0, 'NETWORK_ERROR', 'Network error occurred');
    }
  }

  private async refreshTokens(): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'REFRESH_FAILED', 'Failed to refresh token');
    }

    const data = await response.json();
    return data.data?.tokens || data.tokens;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const queryString = params
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return this.request<T>(`${path}${queryString}`, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body ?? {}),
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body ?? {}),
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient({
  onTokenRefresh: (tokens) => {
    import('@/lib/hooks/use-admin-auth').then(({ useAdminAuth }) => {
      useAdminAuth.setState({ token: tokens.accessToken });
    });
  },
});
