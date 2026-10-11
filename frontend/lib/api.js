export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';

export const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '');
  }
  return 'http://localhost:5000';
};

// Helper to get tokens
const getAccessToken = () => typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
const getRefreshToken = () => typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

const setTokens = (accessToken, refreshToken) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
};

const clearTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('profile');
  }
};

// Make request wrapper
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  // Setup headers
  const headers = { ...options.headers };
  const token = getAccessToken();
  
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Detect FormData, don't override Content-Type in that case
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let config = {
    ...options,
    headers
  };

  const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register') || endpoint.includes('/auth/refresh');

  try {
    let response = await fetch(url, config);
    
    // Auto-refresh token if 401 unauthenticated (only for protected resource endpoints, NOT auth endpoints)
    if (!isAuthEndpoint && response.status === 401 && getRefreshToken()) {
      console.log('Access token invalid/expired, attempting refresh...');
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry original request with new token
        config.headers['Authorization'] = `Bearer ${getAccessToken()}`;
        response = await fetch(url, config);
      }
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      // Clear invalid session only if authentication fails (401) on protected endpoints
      if (!isAuthEndpoint && response.status === 401) {
        clearTokens();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      throw new Error(errData.error || `HTTP error ${response.status}`);
    }

    // Check if SSE stream response
    if (config.headers['Accept'] === 'text/event-stream' || response.headers.get('content-type')?.includes('text/event-stream')) {
      return response; // Return raw response for streaming reader
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message?.includes('Failed to fetch')) {
      console.error(`[API] Server unreachable for ${endpoint}. Backend may be down.`);
      throw new Error('Server is unreachable. Please ensure Express backend is running on port 5000.');
    }
    console.error(`API Request Error [${endpoint}]:`, err.message);
    throw err;
  }
}

// Token refresh utility
async function refreshAccessToken() {
  const rToken = getRefreshToken();
  if (!rToken) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rToken })
    });

    if (res.ok) {
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
  } catch (e) {
    console.error('Refresh token API failed:', e);
  }
  return false;
}

export const api = {
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'DELETE' }),
  upload: (endpoint, formData, options = {}) => apiRequest(endpoint, { ...options, method: 'POST', body: formData, headers: {} }),
  setTokens,
  clearTokens
};
