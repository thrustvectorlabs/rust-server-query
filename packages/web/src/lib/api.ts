const DEFAULT_BASE_URL = '/api';

function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured && typeof configured === 'string') {
    return configured.replace(/\/+$/, '');
  }
  return DEFAULT_BASE_URL;
}

const BASE_URL = resolveBaseUrl();

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message ?? `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

async function extractErrorMessage(response: Response): Promise<string | null> {
  try {
    const data = await response.json();
    if (data && typeof data === 'object' && 'error' in data) {
      return String((data as { error: unknown }).error);
    }
  } catch {
    // noop
  }
  return response.statusText || null;
}
