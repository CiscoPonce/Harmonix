import {
  parsePlaylistDetailDto,
  parseSpotifyAuthStartResponse,
  parseSpotifyPlaylistListResponse,
  parseSpotifyStatusResponse,
  type SpotifyConnectionDto,
  type SpotifyPlaylistDetailDto,
  type SpotifyPlaylistListResponse,
} from './spotifyContracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

/** ngrok free tier returns HTML unless this header is present (WebView fetch). */
function applyDefaultHeaders(headers: Headers) {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  if (host.includes('ngrok-free.app') || host.includes('ngrok-free.dev')) {
    headers.set('ngrok-skip-browser-warning', 'true');
  }
}

export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const preview = (await res.text()).slice(0, 120);
    throw new Error(
      preview.startsWith('<!DOCTYPE') || preview.startsWith('<html')
        ? 'Server returned a page instead of data. Check your connection and try again.'
        : `Unexpected response (${res.status}): ${preview}`
    );
  }
  return res.json() as Promise<T>;
}

async function refreshAccessToken() {
  try {
    const headers = new Headers();
    applyDefaultHeaders(headers);
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });

    if (res.ok) {
      const data = await parseJsonResponse<{ accessToken: string }>(res);
      accessToken = data.accessToken;
      return accessToken;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  return null;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  console.log(`[apiFetch] Requesting: ${url}`);

  const headers = new Headers(options.headers);
  applyDefaultHeaders(headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  try {
    let response = await fetch(url, config);
    console.log(`[apiFetch] Response from ${endpoint}: ${response.status}`);

    if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
      console.log(`[apiFetch] 401 detected on ${endpoint}, attempting refresh...`);
      const newToken = await refreshAccessToken();
      if (newToken) {
        console.log(`[apiFetch] Refresh success, retrying ${endpoint}`);
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, {
          ...config,
          headers,
        });
      } else {
        console.log(`[apiFetch] Refresh failed, redirecting to login`);
        accessToken = null;
        if (typeof window !== 'undefined') {
          const watch = window.location.pathname.startsWith('/watch');
          window.location.href = watch ? '/watch/login' : '/login';
        }
      }
    }

    return response;
  } catch (error) {
    console.error(`[apiFetch] Fetch error on ${endpoint}:`, error);
    throw error;
  }
}

export async function fetchSpotifyStatus(): Promise<SpotifyConnectionDto> {
  const res = await apiFetch('/spotify/status');
  if (!res.ok) {
    throw new Error('Could not load Spotify connection status.');
  }
  const data = await parseJsonResponse<unknown>(res);
  return parseSpotifyStatusResponse(data);
}

/** Start OAuth; returns a validated accounts.spotify.com URL for browser navigation. */
export async function startSpotifyAuth(): Promise<string> {
  const res = await apiFetch('/spotify/auth/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client: 'web' }),
  });
  if (!res.ok) {
    throw new Error('Could not start Spotify authorization.');
  }
  const data = await parseJsonResponse<unknown>(res);
  return parseSpotifyAuthStartResponse(data);
}

/** Disconnect; caller must wait for success before clearing provider UI. */
export async function disconnectSpotify(): Promise<void> {
  const res = await apiFetch('/spotify/connection', { method: 'DELETE' });
  if (!res.ok) {
    throw new Error('Could not disconnect Spotify.');
  }
}

export async function fetchSpotifyPlaylists(): Promise<SpotifyPlaylistListResponse> {
  const res = await apiFetch('/spotify/playlists');
  if (!res.ok) {
    const err = new Error('Could not load Spotify playlists.') as Error & {
      status?: number;
      body?: unknown;
    };
    err.status = res.status;
    try {
      err.body = await parseJsonResponse<unknown>(res);
    } catch {
      err.body = null;
    }
    throw err;
  }
  const data = await parseJsonResponse<unknown>(res);
  return parseSpotifyPlaylistListResponse(data);
}

export async function fetchSpotifyPlaylistDetail(
  providerId: string
): Promise<SpotifyPlaylistDetailDto> {
  const res = await apiFetch(`/spotify/playlists/${encodeURIComponent(providerId)}`);
  if (!res.ok) {
    const err = new Error('Could not load Spotify playlist.') as Error & {
      status?: number;
      body?: unknown;
    };
    err.status = res.status;
    try {
      err.body = await parseJsonResponse<unknown>(res);
    } catch {
      err.body = null;
    }
    throw err;
  }
  const data = await parseJsonResponse<unknown>(res);
  return parsePlaylistDetailDto(data);
}
