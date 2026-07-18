import type { CapacitorConfig } from '@capacitor/cli';

// Native iOS shell for the Fortitude Domotica web app (Capacitor).
// The compiled web app (webDir) is bundled INSIDE the app; API + WebSocket
// calls go out to the KNX controller over its Tailscale HTTPS address
// (configured at runtime in the app, see src/lib/native.js — NATIVE_SERVER_URL).
const config: CapacitorConfig = {
  appId: 'digital.fortitude.domotica',
  appName: 'Fortitude Domotica',
  webDir: 'dist',
  server: {
    // Serve the bundled app from https://localhost (not capacitor://) so it's a
    // secure context and Secure cookies / modern web APIs behave predictably.
    iosScheme: 'https',
  },
  ios: {
    // Dark control-room background behind the web view during load.
    backgroundColor: '#0d1220',
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0d1220',
      showSpinner: false,
    },
  },
};

export default config;
