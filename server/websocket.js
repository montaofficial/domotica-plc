import { WebSocketServer } from 'ws';
import knxService from './knx-service.js';
import { authenticateWebSocket } from './auth.js';

let wss = null;
const clients = new Set();

export function initializeWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, request) => {
    // Authenticate WebSocket connection
    const user = authenticateWebSocket(request);

    if (!user) {
      console.log('[WS] Unauthorized connection attempt');
      ws.close(4001, 'Unauthorized');
      return;
    }

    console.log(`[WS] Client connected (user: ${user.username})`);
    ws.user = user;
    clients.add(ws);

    // Send current KNX connection status
    ws.send(JSON.stringify({
      type: 'connection_status',
      data: knxService.getStatus()
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleClientMessage(ws, data);
      } catch (error) {
        console.error('[WS] Invalid message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[WS] Client error:', error);
      clients.delete(ws);
    });
  });

  // Forward KNX events to all connected clients
  setupKNXEventForwarding();

  console.log('[WS] WebSocket server initialized (auth required)');
}

function handleClientMessage(ws, message) {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'get_status':
      ws.send(JSON.stringify({
        type: 'connection_status',
        data: knxService.getStatus()
      }));
      break;

    case 'subscribe':
      // Could implement per-client subscriptions here
      break;

    default:
      console.log('[WS] Unknown message type:', message.type);
  }
}

function setupKNXEventForwarding() {
  // Forward all telegrams
  knxService.on('telegram', (telegram) => {
    broadcast({
      type: 'telegram',
      data: telegram
    });
  });

  // Forward state changes
  knxService.on('state_change', (data) => {
    broadcast({
      type: 'state_change',
      data
    });
  });

  // Forward device discoveries
  knxService.on('device_discovered', (device) => {
    broadcast({
      type: 'device_discovered',
      data: device
    });
  });

  // Forward group address discoveries
  knxService.on('group_address_discovered', (ga) => {
    broadcast({
      type: 'group_address_discovered',
      data: ga
    });
  });

  // Forward connection status changes
  knxService.on('connected', () => {
    broadcast({
      type: 'connection_status',
      data: knxService.getStatus()
    });
  });

  knxService.on('disconnected', () => {
    broadcast({
      type: 'connection_status',
      data: knxService.getStatus()
    });
  });

  // Forward write results
  knxService.on('write_success', (data) => {
    broadcast({
      type: 'write_success',
      data
    });
  });

  knxService.on('write_error', (data) => {
    broadcast({
      type: 'write_error',
      data: {
        ...data,
        error: data.error?.message || String(data.error)
      }
    });
  });
}

function broadcast(message) {
  const payload = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(payload);
      } catch (error) {
        console.error('[WS] Broadcast error:', error);
      }
    }
  }
}

export function getConnectedClientCount() {
  return clients.size;
}

export { broadcast };
