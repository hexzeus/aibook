/**
 * WebSocket Hook for Real-time Notifications
 * Connects to backend WebSocket to receive instant notifications
 */
import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = import.meta.env.VITE_API_URL?.replace('http', 'ws') || 'ws://localhost:8000';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  license_key: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    license_key,
    onMessage,
    onConnect,
    onDisconnect,
    reconnect = true
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!license_key) {
      console.log('[WebSocket] No license key provided, skipping connection');
      return;
    }

    // Close existing connection
    if (ws.current) {
      ws.current.close();
    }

    try {
      console.log(`[WebSocket] Connecting to ${WS_URL}/ws/notifications/${license_key}...`);
      ws.current = new WebSocket(`${WS_URL}/ws/notifications/${license_key}`);

      ws.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        onConnect?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Received message:', message);
          onMessage?.(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        onDisconnect?.();

        // Attempt reconnection
        if (reconnect) {
          console.log('[WebSocket] Reconnecting in 3 seconds...');
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
    }
  }, [license_key, onMessage, onConnect, onDisconnect, reconnect]);

  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message, not connected');
    }
  }, []);

  return {
    isConnected,
    sendMessage,
    reconnect: connect
  };
}
