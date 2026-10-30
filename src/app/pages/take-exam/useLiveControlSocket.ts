import { useCallback, useEffect, useRef, useState } from "react";

import { buildWsUrl } from "../../lib/env";
import { getStoredTokens } from "../../lib/storage";
import { parseLiveRequestEnabled } from "./utils";

const RECONNECT_DELAY_MS = 3000;

/**
 * Kenh dieu khien giam sat: giam thi bat/tat xem webcam truc tiep qua WebSocket.
 * Tu ket noi lai sau 3 giay khi rot. Tra ve ham dong kenh (dung khi don tai nguyen giam sat).
 */
export function useLiveControlSocket(
  active: boolean,
  sessionId: number | undefined,
  onLiveRequest: (enabled: boolean) => void,
) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const [revision, setRevision] = useState(0);
  const onLiveRequestRef = useRef(onLiveRequest);
  onLiveRequestRef.current = onLiveRequest;

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const closeControlSocket = useCallback(() => {
    clearReconnectTimeout();
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, [clearReconnectTimeout]);

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!active || sessionId === undefined || !tokens?.access) {
      closeControlSocket();
      return;
    }

    let isActive = true;
    const scheduleReconnect = () => {
      if (!isActive || reconnectTimeoutRef.current !== null) {
        return;
      }
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        if (!isActive) {
          return;
        }
        setRevision((current) => current + 1);
      }, RECONNECT_DELAY_MS);
    };

    const websocket = new WebSocket(
      buildWsUrl(`/ws/proctoring/sessions/${sessionId}/control/?token=${tokens.access}`),
    );
    socketRef.current = websocket;

    websocket.onopen = () => {
      clearReconnectTimeout();
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type?: string;
          payload?: { enabled?: boolean | string };
        };
        if (message.type !== "live_request") {
          return;
        }
        onLiveRequestRef.current(parseLiveRequestEnabled(message.payload?.enabled));
      } catch {
        // Ignore malformed control payloads and wait for the next update.
      }
    };

    websocket.onerror = () => {
      scheduleReconnect();
    };

    websocket.onclose = () => {
      if (!isActive) {
        return;
      }
      scheduleReconnect();
    };

    return () => {
      isActive = false;
      if (socketRef.current === websocket) {
        socketRef.current = null;
      }
      websocket.close();
    };
  }, [active, sessionId, revision, clearReconnectTimeout, closeControlSocket]);

  return closeControlSocket;
}
