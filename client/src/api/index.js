const API_BASE = '/api';

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include', // Include cookies
    ...options
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
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
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  status: () => request('/auth/status')
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

export { AuthError };
