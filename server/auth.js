import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { credentialsDb } from './database.js';

const BCRYPT_ROUNDS = 12;

const TOKEN_EXPIRY = '24h';
const PLACEHOLDER_SECRETS = new Set([
  'default-secret-change-me',
  'change-this-in-production',
  'generate-a-random-32-char-string-here'
]);

function resolveSessionSecret() {
  const fromEnv = process.env.SESSION_SECRET;

  if (fromEnv && !PLACEHOLDER_SECRETS.has(fromEnv) && fromEnv.length >= 32) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '\n[FATAL] SESSION_SECRET is missing, a placeholder, or shorter than 32 chars.\n' +
      '        Generate one with:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n' +
      '        and set it in your .env before starting in production.\n'
    );
    process.exit(1);
  }

  const generated = crypto.randomBytes(48).toString('hex');
  console.warn(
    '[Auth] SESSION_SECRET not set or too weak - generated an ephemeral one for this run.\n' +
    '       Tokens will be invalidated on every restart. Set SESSION_SECRET in .env for stability.'
  );
  return generated;
}

const JWT_SECRET = resolveSessionSecret();

export function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  // Pad to equal length so timingSafeEqual doesn't throw,
  // but track the real-length mismatch separately so we still return false.
  const len = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(len);
  const bPadded = Buffer.alloc(len);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);
  return crypto.timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length;
}

// One-time migration: on first run, copy the env credentials into the DB with
// the password bcrypt-hashed. After this the DB is the source of truth and the
// user can change username/password from the app. Idempotent (INSERT OR IGNORE).
export function seedCredentialsFromEnv() {
  if (credentialsDb.get()) return; // already seeded
  const username = process.env.AUTH_USERNAME || 'admin';
  const password = process.env.AUTH_PASSWORD;
  if (!password) {
    console.error('[Auth] AUTH_PASSWORD is not set - cannot seed login credentials.');
    return;
  }
  credentialsDb.seed(username, bcrypt.hashSync(password, BCRYPT_ROUNDS));
  console.log('[Auth] Seeded login credentials into the database from .env.');
}

export function getUsername() {
  return credentialsDb.get()?.username || null;
}

// Verify a plaintext password against the stored bcrypt hash.
export function verifyPassword(password) {
  const row = credentialsDb.get();
  if (!row) return false;
  try {
    return bcrypt.compareSync(String(password ?? ''), row.password_hash);
  } catch {
    return false;
  }
}

export function updatePassword(newPassword) {
  credentialsDb.setPasswordHash(bcrypt.hashSync(String(newPassword), BCRYPT_ROUNDS));
}

export function updateUsername(newUsername) {
  credentialsDb.setUsername(String(newUsername));
}

export function validateCredentials(username, password) {
  const row = credentialsDb.get();
  if (!row) {
    console.error('[Auth] No credentials in DB - login rejected. Restart to seed from .env.');
    return false;
  }
  // Username compared timing-safe; password via bcrypt (constant-time by design).
  const userOk = timingSafeStringEqual(username, row.username);
  const passOk = verifyPassword(password);
  return userOk && passOk;
}

// Express middleware for protecting routes. Mounted at '/api' AFTER the
// public '/api/auth' and '/api/health' routes, so everything it sees requires
// a valid token — no per-path allow-list is needed here.
export function authMiddleware(req, res, next) {
  // Check for token in cookie or Authorization header
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

// WebSocket authentication helper.
// - Browser: the HttpOnly session cookie rides along on the WS handshake.
// - Native app: no cross-origin cookie, so the token is passed as the second
//   WebSocket subprotocol ("bearer, <jwt>"). We deliberately do NOT accept a
//   token in the query string — that would leak a valid JWT into proxy/access
//   logs that record the URL. The subprotocol is a request header, not the URL.
export function authenticateWebSocket(request) {
  const cookies = parseCookies(request.headers.cookie || '');
  let token = cookies.token;

  if (!token) {
    const proto = request.headers['sec-websocket-protocol'];
    if (proto) {
      const parts = proto.split(',').map((s) => s.trim());
      const i = parts.indexOf('bearer');
      if (i >= 0 && parts[i + 1]) token = parts[i + 1];
    }
  }

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    cookies[name.trim()] = rest.join('=').trim();
  });

  return cookies;
}
