// Minimal in-memory rate limiter (single-instance friendly).
// For multi-instance deployments, swap with a Redis-backed limiter.

function getClientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter({ windowMs, max, message = 'Too many requests' }) {
  const hits = new Map();

  // Periodic cleanup so the map can't grow unbounded.
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs).unref();

  function middleware(req, res, next) {
    const key = getClientKey(req);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: message, retryAfter: retryAfterSec });
    }
    next();
  }

  middleware.stop = () => clearInterval(sweepInterval);
  return middleware;
}
