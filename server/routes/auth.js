import { Router } from 'express';
import { z } from 'zod';
import { generateToken, validateCredentials, verifyToken } from '../auth.js';
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

    res.json({
      success: true,
      user: { username },
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
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
