const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

async function refreshAccessToken() {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    
    if (res.ok) {
      const data = await res.json();
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
  
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  let response = await fetch(url, config);

  // If unauthorized and not already trying to refresh or login
  if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, {
        ...config,
        headers,
      });
    } else {
      accessToken = null;
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }

  return response;
}
