import type { Bookmark, DirListing, Meta, Session, RecentDir } from './types.ts';

// Capture the token from the URL on first load, remember it, and tidy the URL.
const params = new URLSearchParams(window.location.search);
let token = params.get('token') ?? sessionStorage.getItem('crs_token') ?? '';
if (params.get('token')) {
  sessionStorage.setItem('crs_token', token);
  params.delete('token');
  const query = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
}

export function getToken(): string {
  return token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

function withToken(path: string): string {
  if (!token) return path;
  return `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withToken(path), {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  meta: () => req<Meta>('/api/meta'),
  listSessions: () => req<{ sessions: Session[] }>('/api/sessions'),
  createSession: (dir: string, name: string) =>
    req<{ session: Session }>('/api/sessions', { method: 'POST', body: JSON.stringify({ dir, name }) }),
  stopSession: (id: string) => req<void>(`/api/sessions/${id}`, { method: 'DELETE' }),
  renameSession: (id: string, name: string) =>
    req<{ session: Session }>(`/api/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  listDir: (path: string) => req<DirListing>(`/api/fs?path=${encodeURIComponent(path)}`),
  listBookmarks: () => req<{ bookmarks: Bookmark[] }>('/api/bookmarks'),
  addBookmark: (path: string, label?: string) =>
    req<{ bookmark: Bookmark }>('/api/bookmarks', { method: 'POST', body: JSON.stringify({ path, label }) }),
  removeBookmark: (id: string) => req<void>(`/api/bookmarks/${id}`, { method: 'DELETE' }),
  listRecent: () => req<{ recent: RecentDir[] }>('/api/recent'),
};

export function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const base = `${proto}://${window.location.host}/ws`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
