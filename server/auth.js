import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

export function validateCredentials(username, password) {
  const validUsername = process.env.AUTH_USERNAME || 'admin';
  const validPassword = process.env.AUTH_PASSWORD;

  if (!validPassword) {
    console.error('[Auth] AUTH_PASSWORD is not set - rejecting all logins.');
    return false;
  }

  return (
    timingSafeStringEqual(username, validUsername) &&
    timingSafeStringEqual(password, validPassword)
  );
}

// Express middleware for protecting routes
export function authMiddleware(req, res, next) {
  // Skip auth for login endpoint
  if (req.path === '/api/auth/login' || req.path === '/api/auth/status') {
    return next();
  }

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

// WebSocket authentication helper
export function authenticateWebSocket(request) {
  // Try to get token from cookie
  const cookies = parseCookies(request.headers.cookie || '');
  let token = cookies.token;

  // Or from query string
  if (!token) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    token = url.searchParams.get('token');
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
