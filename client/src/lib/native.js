// Native-app (Capacitor/iOS) helpers. On the web build every export here is a
// no-op / falsy, so the browser app behaves exactly as before — all native
// branches are guarded by isNative().

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export function isNative() {
  return Capacitor?.isNativePlatform?.() === true;
}

// Where the KNX controller lives, as seen from a phone that is NOT on the office
// LAN. Filled in once Tailscale is up (e.g. https://fortitude-domotica.<tailnet>.ts.net).
// Can be overridden at runtime and stored, so the app doesn't need a rebuild to
// point at a different address.
export const DEFAULT_NATIVE_SERVER_URL = 'https://REPLACE-WITH-TAILSCALE-URL.ts.net';

const SERVER_KEY = 'server_url';
const TOKEN_KEY = 'auth_token';

let cachedServerUrl = null;
let cachedToken = null;

// Resolve the API origin. Web: '' (same-origin, relative /api). Native: the
// stored/overridden server URL (no trailing slash).
export async function getServerUrl() {
  if (!isNative()) return '';
  if (cachedServerUrl != null) return cachedServerUrl;
  try {
    const { value } = await Preferences.get({ key: SERVER_KEY });
    cachedServerUrl = (value || DEFAULT_NATIVE_SERVER_URL).replace(/\/+$/, '');
  } catch {
    cachedServerUrl = DEFAULT_NATIVE_SERVER_URL;
  }
  return cachedServerUrl;
}

export async function setServerUrl(url) {
  cachedServerUrl = String(url || '').replace(/\/+$/, '');
  try { await Preferences.set({ key: SERVER_KEY, value: cachedServerUrl }); } catch { /* ignore */ }
}

// Bearer token: only used on native (web keeps the HttpOnly cookie flow).
export async function getToken() {
  if (!isNative()) return null;
  if (cachedToken != null) return cachedToken;
  try {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    cachedToken = value || null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setToken(token) {
  cachedToken = token || null;
  try {
    if (token) await Preferences.set({ key: TOKEN_KEY, value: token });
    else await Preferences.remove({ key: TOKEN_KEY });
  } catch { /* ignore */ }
}

export async function clearToken() {
  return setToken(null);
}
