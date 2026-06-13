const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

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
  console.log(`[apiFetch] Requesting: ${url}`);
  
  const headers = new Headers(options.headers);
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

    // If unauthorized and not already trying to refresh or login
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
          window.location.href = '/login';
        }
      }
    }

    return response;
  } catch (error) {
    console.error(`[apiFetch] Fetch error on ${endpoint}:`, error);
    throw error;
  }
}
