import { useEffect, useRef } from 'react';
import { getReconnectDelayMs, MAX_RECONNECT_ATTEMPTS } from '../utils/reconnectBackoff';

type ReconnectingWebSocketOptions = {
  enabled: boolean;
  connectionKey?: string | number | boolean | null;
  createSocket: () => WebSocket | Promise<WebSocket>;
  maxAttempts?: number;
  onOpen?: (socket: WebSocket, event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onConnectError?: (error: unknown) => void;
  onReconnectExhausted?: (attempts: number) => void;
};

const useLatestRef = <T,>(value: T) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

export const useReconnectingWebSocket = ({
  enabled,
  connectionKey = null,
  createSocket,
  maxAttempts = MAX_RECONNECT_ATTEMPTS,
  onOpen,
  onClose,
  onError,
  onMessage,
  onConnectError,
  onReconnectExhausted,
}: ReconnectingWebSocketOptions) => {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectExhaustedRef = useRef(false);
  const createSocketRef = useLatestRef(createSocket);
  const maxAttemptsRef = useLatestRef(maxAttempts);
  const onOpenRef = useLatestRef(onOpen);
  const onCloseRef = useLatestRef(onClose);
  const onErrorRef = useLatestRef(onError);
  const onMessageRef = useLatestRef(onMessage);
  const onConnectErrorRef = useLatestRef(onConnectError);
  const onReconnectExhaustedRef = useLatestRef(onReconnectExhausted);

  useEffect(() => {
    if (!enabled) return;

    let shouldReconnect = true;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (!shouldReconnect) return;
      clearReconnectTimer();

      const limit = Math.max(0, Math.floor(maxAttemptsRef.current));
      if (reconnectAttemptRef.current >= limit) {
        if (!reconnectExhaustedRef.current) {
          reconnectExhaustedRef.current = true;
          onReconnectExhaustedRef.current?.(reconnectAttemptRef.current);
        }
        return;
      }

      const attempt = reconnectAttemptRef.current;
      reconnectAttemptRef.current = attempt + 1;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, getReconnectDelayMs(attempt));
    };

    function connect() {
      if (!shouldReconnect) return;

      let socketOrPromise: WebSocket | Promise<WebSocket>;
      try {
        socketOrPromise = createSocketRef.current();
      } catch (error) {
        onConnectErrorRef.current?.(error);
        scheduleReconnect();
        return;
      }

      const attachSocket = (socket: WebSocket) => {
        if (!shouldReconnect) {
          socket.close();
          return;
        }
        socketRef.current = socket;
        socket.onopen = (event) => {
          reconnectAttemptRef.current = 0;
          reconnectExhaustedRef.current = false;
          onOpenRef.current?.(socket, event);
        };
        socket.onclose = (event) => {
          onCloseRef.current?.(event);
          scheduleReconnect();
        };
        socket.onerror = (event) => {
          onErrorRef.current?.(event);
        };
        socket.onmessage = (event) => {
          onMessageRef.current?.(event);
        };
      };

      if (typeof (socketOrPromise as Promise<WebSocket>).then === 'function') {
        (socketOrPromise as Promise<WebSocket>)
          .then(attachSocket)
          .catch((error) => {
            if (!shouldReconnect) return;
            onConnectErrorRef.current?.(error);
            scheduleReconnect();
          });
        return;
      }

      attachSocket(socketOrPromise as WebSocket);
    }

    connect();

    return () => {
      shouldReconnect = false;
      clearReconnectTimer();
      reconnectAttemptRef.current = 0;
      reconnectExhaustedRef.current = false;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [
    enabled,
    connectionKey,
    createSocketRef,
    maxAttemptsRef,
    onCloseRef,
    onConnectErrorRef,
    onErrorRef,
    onMessageRef,
    onOpenRef,
    onReconnectExhaustedRef,
  ]);

  return socketRef;
};
