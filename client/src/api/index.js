import { isNative, getServerUrl, getToken, setToken, cfAccessHeaders } from '../lib/native';

const API_BASE = '/api';

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

// Global hook so the app can react to an expired/invalid session (401) from
// anywhere — without it, queries just surface error cards and the user is
// stuck "logged in" with no way back to the login screen.
let onAuthError = null;
export function setAuthErrorHandler(fn) { onAuthError = fn; }

async function request(endpoint, options = {}) {
  // Web: same-origin, relative '/api'. Native: absolute URL to the controller
  // (its Tailscale address) — the bundled app can't use a relative path.
  const base = await getServerUrl(); // '' on web
  const url = `${base}${API_BASE}${endpoint}`;

  // Native uses a Bearer token (no cross-origin cookie); web keeps the cookie.
  const token = await getToken(); // null on web
  const { headers: optHeaders, ...restOptions } = options;

  const config = {
    credentials: 'include', // web: send the HttpOnly cookie
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...cfAccessHeaders(), // native: pass the Cloudflare Access gate (no-op on web)
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...optHeaders
    }
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Don't fire on the status probe itself (that's how we check auth on load).
    if (endpoint !== '/auth/status' && onAuthError) onAuthError();
    throw new AuthError('Authentication required');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: async (username, password) => {
    // On native we ask the server to also return the token in the body (via
    // X-Native) and store it; the web build gets cookie-only (token stays out
    // of JS, XSS-safe).
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      ...(isNative() ? { headers: { 'X-Native': '1' } } : {})
    });
    if (isNative() && res?.token) await setToken(res.token);
    return res;
  },
  logout: async () => {
    const res = await request('/auth/logout', { method: 'POST' }).catch(() => null);
    if (isNative()) await setToken(null);
    return res;
  },
  status: () => request('/auth/status'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
      ...(isNative() ? { headers: { 'X-Native': '1' } } : {})
    }),
  changeUsername: async (currentPassword, newUsername) => {
    // Changing the username re-issues the token (the JWT embeds it). On native
    // we store the fresh token so the session keeps working after the change.
    const res = await request('/auth/change-username', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newUsername }),
      ...(isNative() ? { headers: { 'X-Native': '1' } } : {})
    });
    if (isNative() && res?.token) await setToken(res.token);
    return res;
  }
};

// Rooms API
export const roomsApi = {
  getAll: () => request('/rooms'),
  getById: (id) => request(`/rooms/${id}`),
  create: (data) => request('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/rooms/${id}`, { method: 'DELETE' })
};

// Devices API
export const devicesApi = {
  getAll: () => request('/devices'),
  getById: (id) => request(`/devices/${id}`),
  update: (id, data) => request(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};

// Group Addresses API
export const groupAddressesApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/group-addresses${query ? `?${query}` : ''}`);
  },
  getConfigured: () => request('/group-addresses?configured=true'),
  getDiscovered: () => request('/group-addresses/discovered'),
  getById: (id) => request(`/group-addresses/${id}`),
  getByAddress: (address) => request(`/group-addresses/by-address/${encodeURIComponent(address)}`),
  create: (data) => request('/group-addresses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/group-addresses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/group-addresses/${id}`, { method: 'DELETE' }),
  getTypes: () => request('/group-addresses/types')
};

// Control API
export const controlApi = {
  write: (address, value, dataType) =>
    request(`/control/${encodeURIComponent(address)}`, {
      method: 'POST',
      body: JSON.stringify({ value, dataType })
    }),
  toggle: (address) =>
    request(`/control/${encodeURIComponent(address)}/toggle`, { method: 'POST' }),
  on: (address) =>
    request(`/control/${encodeURIComponent(address)}/on`, { method: 'POST' }),
  off: (address) =>
    request(`/control/${encodeURIComponent(address)}/off`, { method: 'POST' }),
  read: (address) =>
    request(`/control/${encodeURIComponent(address)}/read`)
};

// Status API
export const statusApi = {
  get: () => request('/status')
};

// History API
export const historyApi = {
  getRecent: (limit = 100) => request(`/history?limit=${limit}`),
  getByAddress: (address, limit = 50) =>
    request(`/history?address=${encodeURIComponent(address)}&limit=${limit}`)
};

// Learn engine API
export const learnApi = {
  state: () => request('/learn/state'),
  profile: () => request('/learn/profile'),
  detections: () => request('/learn/detections'),
  startBaseline: (durationMs) =>
    request('/learn/baseline/start', {
      method: 'POST',
      body: JSON.stringify(durationMs ? { durationMs } : {})
    }),
  extendBaseline: (durationMs) =>
    request('/learn/baseline/extend', {
      method: 'POST',
      body: JSON.stringify(durationMs ? { durationMs } : {})
    }),
  stopBaseline: () => request('/learn/baseline/stop', { method: 'POST' }),
  resetBaseline: () => request('/learn/baseline', { method: 'DELETE' }),
  excludeFromNoise: (dst) =>
    request('/learn/baseline/exclude', {
      method: 'POST',
      body: JSON.stringify({ dst })
    }),
  startLearning: ({ threshold, echoFilter } = {}) =>
    request('/learn/start', {
      method: 'POST',
      body: JSON.stringify({
        ...(threshold != null ? { threshold } : {}),
        ...(echoFilter != null ? { echoFilter } : {})
      })
    }),
  setThreshold: (threshold) =>
    request('/learn/threshold', {
      method: 'PATCH',
      body: JSON.stringify({ threshold })
    }),
  setEchoFilter: (enabled) =>
    request('/learn/echo-filter', {
      method: 'PATCH',
      body: JSON.stringify({ enabled })
    }),
  stopLearning: () => request('/learn/stop', { method: 'POST' })
};

// Topology mapping API (passive)
export const topologyApi = {
  scan: (opts = {}) =>
    request('/topology/scan', { method: 'POST', body: JSON.stringify(opts) }),
  evidence: () => request('/topology/evidence'),
  map: () => request('/topology/map'),
  classify: (items) =>
    request('/topology/classify', { method: 'PATCH', body: JSON.stringify({ items }) })
};

export { AuthError };
