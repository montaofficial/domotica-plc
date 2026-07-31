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
    // Route fetch/XHR through the native HTTP stack. Native requests are NOT
    // subject to browser CORS, so the WKWebView no longer sends a preflight
    // OPTIONS — which Cloudflare Access was rejecting (the preflight can't
    // carry the service token, so Access 403'd it and the real request never
    // fired). With this on, the CF-Access headers ride the actual request and
    // Access lets it through. Web build is unaffected (plugin is iOS/native).
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
