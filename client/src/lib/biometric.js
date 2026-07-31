// Face ID / Touch ID login helper (native only). Wraps the Capgo biometric
// plugin: the password lives in the iOS Keychain, unlocked by biometrics. On
// web every function is a safe no-op.
import { Preferences } from '@capacitor/preferences';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { isNative } from './native';

const SERVER = 'fortitude-domotica';       // Keychain entry key
const ENABLED_KEY = 'biometric_enabled';   // Preferences flag (cheap to check)

// True when the device has Face ID / Touch ID set up and usable.
export async function biometricAvailable() {
  if (!isNative()) return false;
  try {
    const r = await NativeBiometric.isAvailable();
    return !!r?.isAvailable;
  } catch {
    return false;
  }
}

// Whether the user has opted in (creds stored). We keep a lightweight flag so we
// can decide to show the Face ID button WITHOUT triggering a biometric prompt.
export async function biometricEnabled() {
  if (!isNative()) return false;
  try {
    const { value } = await Preferences.get({ key: ENABLED_KEY });
    return value === '1';
  } catch {
    return false;
  }
}

// Store the credentials in the Keychain and flip the opt-in flag.
export async function enableBiometric(username, password) {
  if (!isNative()) return false;
  await NativeBiometric.setCredentials({ username, password, server: SERVER });
  await Preferences.set({ key: ENABLED_KEY, value: '1' });
  return true;
}

export async function disableBiometric() {
  if (!isNative()) return;
  try { await NativeBiometric.deleteCredentials({ server: SERVER }); } catch { /* already gone */ }
  await Preferences.remove({ key: ENABLED_KEY });
}

// Prompt Face ID, then return the stored credentials. Returns null if the user
// cancels, biometrics fail, or nothing is stored — the caller falls back to the
// normal password form.
export async function loginWithBiometric() {
  if (!isNative()) return null;
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Accedi a Fortitude Domotica',
      title: 'Sblocca con Face ID',
      subtitle: '',
      description: ''
    });
    const creds = await NativeBiometric.getCredentials({ server: SERVER });
    if (creds?.username && creds?.password) return creds;
    return null;
  } catch {
    return null; // cancelled or failed — let the user type the password
  }
}
