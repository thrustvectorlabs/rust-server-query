const DEFAULT_BASE_URL = '/api';

const BASE_URL = resolveBaseUrl();

function resolveBaseUrl(): string {
  const configured =
    import.meta.env.VITE_API_URL ??
    import.meta.env.VITE_SERVER_API_URL ??
    null;

  if (configured && typeof configured === 'string') {
    return configured.trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
  }

  const baseUrl = typeof import.meta.env.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/';
  const baseTrimmed = baseUrl.replace(/\/+$/, '');
  return `${baseTrimmed}${DEFAULT_BASE_URL}` || DEFAULT_BASE_URL;
}

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
