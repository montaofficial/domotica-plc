import { Router } from 'express';
import { z } from 'zod';
import {
  generateToken,
  validateCredentials,
  verifyToken,
  authMiddleware,
  verifyPassword,
  updatePassword,
  updateUsername,
  getUsername
} from '../auth.js';
import { createRateLimiter } from '../utils/rate-limit.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200)
});

// Brute-force protection: 10 attempts per IP per 15 minutes.
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later.'
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    if (!validateCredentials(username, password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(username);

    // `secure` must reflect the actual request scheme, not NODE_ENV:
    // setting Secure over plain HTTP makes browsers silently drop the cookie
    // (RFC 6265 §4.1.2.5), which breaks LAN access on http://<host>:3000.
    // With `trust proxy` set in index.js, req.secure also returns true behind
    // a TLS-terminating reverse proxy that sets X-Forwarded-Proto.
    res.cookie('token', token, {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    // The browser gets the token ONLY as the HttpOnly cookie above — echoing it
    // in the body would let page JS stash it and turn any XSS into token theft.
    // The native app (Capacitor WKWebView) can't use a cross-origin cookie, so
    // it explicitly asks for the token via X-Native and stores it in the app's
    // own storage. That request never runs in a browser tab, so the XSS vector
    // doesn't apply.
    const nativeClient = req.get('X-Native') === '1';
    res.json({
      success: true,
      user: { username },
      ...(nativeClient ? { token } : {})
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Change password/username require a valid session AND the current password.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200)
});

const changeUsernameSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newUsername: z.string().min(1).max(100)
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    if (!verifyPassword(currentPassword)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'New password must differ from the current one' });
    }
    updatePassword(newPassword);
    // Existing tokens stay valid (JWT carries only the username). The client can
    // keep its session; there's nothing to re-issue for a password change.
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    console.error('Change-password error:', error);
    res.status(500).json({ error: 'Could not change password' });
  }
});

// POST /api/auth/change-username
router.post('/change-username', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newUsername } = changeUsernameSchema.parse(req.body);
    if (!verifyPassword(currentPassword)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    updateUsername(newUsername);

    // The JWT embeds the username, so the old token no longer matches. Re-issue
    // one and refresh the cookie; native clients get it in the body to re-store.
    const token = generateToken(newUsername);
    res.cookie('token', token, {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
    const nativeClient = req.get('X-Native') === '1';
    res.json({
      success: true,
      user: { username: newUsername },
      ...(nativeClient ? { token } : {})
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid username' });
    }
    console.error('Change-username error:', error);
    res.status(500).json({ error: 'Could not change username' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// GET /api/auth/status - Check if user is authenticated
router.get('/status', (req, res) => {
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.json({ authenticated: false });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: { username: decoded.username }
  });
});

export default router;
