const API_BASE = import.meta.env.VITE_API_URL || '/api';
const DEFAULT_TIMEOUT = 10000; // 10s
const MAX_RETRIES = 3;

class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(
        response.status,
        error.error || 'Request failed',
        error.details
      );
    }

    return response;
  } catch (err) {
    clearTimeout(timeout);

    // Retry on network errors or 5xx
    if (
      retries > 0 &&
      (err instanceof TypeError || (err instanceof ApiError && err.status >= 500))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s backoff
      return fetchWithRetry(url, options, retries - 1);
    }

    throw err;
  }
}

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetchWithRetry(`${API_BASE}${endpoint}`);
    return response.json();
  },

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetchWithRetry(`${API_BASE}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async put<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetchWithRetry(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async delete<T>(endpoint: string): Promise<T | null> {
    const response = await fetchWithRetry(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
    });
    // DELETE returns 204 No Content, so don't try to parse JSON
    if (response.status === 204) {
      return null;
    }
    return response.json();
  },
};

export { ApiError };
