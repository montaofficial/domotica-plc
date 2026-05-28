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

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(1000 * reconnectAttemptsRef.current, 10000);

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
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

  return {
    connected,
    knxStatus,
    send
  };
}

export default useWebSocket;
