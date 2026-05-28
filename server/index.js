import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import knxService from './knx-service.js';
import learnEngine from './learn-engine.js';
import { initializeWebSocket, getConnectedClientCount } from './websocket.js';
import { authMiddleware } from './auth.js';
import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import devicesRouter from './routes/devices.js';
import groupAddressesRouter from './routes/group-addresses.js';
import controlRouter from './routes/control.js';
import learnRouter from './routes/learn.js';
import { historyDb, closeDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// CORS: explicit allow-list when CORS_ORIGIN is set, otherwise same-origin only.
// Using `origin: true` would echo any Origin back with credentials:true, which
// effectively disables CORS protection - we deliberately avoid that.
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : false,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Trust proxy for proper IP handling behind NGINX (rate limiter uses req.ip).
app.set('trust proxy', 1);

// Liveness/health probe (unauthenticated, lightweight).
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Apply auth middleware to all other API routes
app.use('/api', authMiddleware);

// Protected API Routes
app.use('/api/rooms', roomsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/group-addresses', groupAddressesRouter);
app.use('/api/control', controlRouter);
app.use('/api/learn', learnRouter);

// Telegram history endpoint
app.get('/api/history', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const address = req.query.address;

    let history;
    if (address) {
      history = historyDb.getByAddress(address, limit);
    } else {
      history = historyDb.getRecent(limit);
    }

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// KNX status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    knx: knxService.getStatus(),
    websocket: {
      clients: getConnectedClientCount()
    }
  });
});

// Serve static files from React build in production
const clientDistPath = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(clientDistPath, 'index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize WebSocket (with auth)
initializeWebSocket(server);

// Initialize KNX connection
knxService.initialize({
  gatewayIp: process.env.KNX_GATEWAY_IP,
  gatewayPort: parseInt(process.env.KNX_GATEWAY_PORT) || 3671,
  localIp: process.env.KNX_LOCAL_IP,
  logLevel: process.env.KNX_LOGLEVEL || 'info'
});

// Swallow KNX errors at the service level so an unreachable gateway
// cannot crash the HTTP/WS server (EventEmitter throws on unhandled
// 'error' events). Reconnect is scheduled inside the service itself.
knxService.on('error', () => {
  // Logging already happens inside the service.
});

// Connect to KNX
knxService.connect();

// Initialise the Learn engine after the KNX service so it can subscribe
// to telegrams on the existing EventEmitter without races.
learnEngine.init();

// Periodic cleanup of old telegram history (keep 7 days)
const cleanupInterval = setInterval(() => {
  try {
    const result = historyDb.cleanup(7);
    if (result.changes > 0) {
      console.log(`[Cleanup] Removed ${result.changes} old telegram records`);
    }
  } catch (error) {
    console.error('[Cleanup] Error:', error);
  }
}, 24 * 60 * 60 * 1000);

// Start server
const PORT = parseInt(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const gatewayStr = (process.env.KNX_GATEWAY_IP || 'not set').padEnd(15);
  const portStr = String(process.env.KNX_GATEWAY_PORT || 3671);
  const authUser = (process.env.AUTH_USERNAME || 'admin').padEnd(20);
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                Domotica PLC / KNX Controller               ║
╠════════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${PORT}
║  API:        http://localhost:${PORT}/api
║  WebSocket:  ws://localhost:${PORT}/ws
╠════════════════════════════════════════════════════════════╣
║  KNX Gateway: ${gatewayStr}:${portStr}
║  Auth user:   ${authUser}
║  NODE_ENV:    ${process.env.NODE_ENV || 'development'}
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[${signal}] Shutting down...`);
  clearInterval(cleanupInterval);
  knxService.disconnect();
  server.close(() => {
    try {
      closeDatabase();
    } catch (err) {
      console.error('[DB] Close error:', err);
    }
    console.log('Server closed cleanly');
    process.exit(0);
  });
  // Hard exit if close hangs.
  setTimeout(() => {
    console.error('Forced exit after 10s');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
