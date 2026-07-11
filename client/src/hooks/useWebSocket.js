import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const [knxStatus, setKnxStatus] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const onMessageRef = useRef(onMessage);
  const shouldConnectRef = useRef(!!onMessage);

  // Keep onMessage ref updated
  useEffect(() => {
    onMessageRef.current = onMessage;
    shouldConnectRef.current = !!onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Don't connect if no message handler (not authenticated)
    if (!shouldConnectRef.current) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log('[WS] Connected');
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onclose = (event) => {
        console.log('[WS] Disconnected', event.code, event.reason);
        setConnected(false);

        // Don't reconnect if closed due to auth failure (4001) or not authenticated
        if (event.code === 4001 || !shouldConnectRef.current) {
          console.log('[WS] Not reconnecting (auth required or disabled)');
          return;
        }

        scheduleReconnect();
      };

      wsRef.current.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle connection status internally
          if (message.type === 'connection_status') {
            setKnxStatus(message.data);
          }

          // Forward all messages to callback
          if (onMessageRef.current) {
            onMessageRef.current(message);
          }
        } catch (error) {
          console.error('[WS] Parse error:', error);
        }
      };
    } catch (error) {
      console.error('[WS] Connection error:', error);
      scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!shouldConnectRef.current) {
      return;
    }
    if (reconnectTimeoutRef.current) {
      return; // a reconnect is already pending
    }

    reconnectAttemptsRef.current++;
    // Back off up to 15s, then keep retrying forever at that interval. Never
    // give up: a wall tablet that outlived a server restart or a Wi-Fi blip
    // must recover on its own, otherwise it shows stale state until a manual
    // reload (and the user acts on lights that aren't in the state shown).
    const delay = Math.min(1000 * reconnectAttemptsRef.current, 15000);

    if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
      console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      connect();
    }, delay);
  }, [connect]);

  // Force an immediate reconnect when the network returns or the tab comes back
  // to the foreground. A phone that slept drops the TCP connection silently:
  // the socket can look OPEN while being a dead "zombie", so we tear it down and
  // reconnect on these signals instead of waiting for a backoff tick.
  const kick = useCallback(() => {
    if (!shouldConnectRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) return; // healthy, leave it
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0; // fresh budget on an explicit wake
    try { ws?.close(); } catch { /* ignore */ }
    connect();
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    // Reset the backoff budget so a later login reconnects with a clean slate.
    reconnectAttemptsRef.current = 0;
    setConnected(false);
  }, []);

  const send = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect when onMessage is provided, disconnect when null
  useEffect(() => {
    if (onMessage) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [onMessage, connect, disconnect]);

  // Wake the socket up when the network or tab state changes.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') kick(); };
    window.addEventListener('online', kick);
    window.addEventListener('focus', kick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', kick);
      window.removeEventListener('focus', kick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [kick]);

  return {
    connected,
    knxStatus,
    send
  };
}

export default useWebSocket;
