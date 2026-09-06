import { useCallback, useEffect, useRef, useState } from "react";

import { sessionService } from "../services/session.service";
import { realtimeService } from "../services/realtime.service";
import type { WhatsAppSession } from "../core/types";

export function useWhatsAppSession(sessionId: string | null, _options: { pollMs?: number } = {}) {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      return null;
    }
    setLoading(true);
    try {
      const next = await sessionService.status({ data: { sessionId } });
      if (mountedRef.current) {
        setSession(next);
        setError(null);
        setLoading(false);
      }
      return next;
    } catch (value) {
      if (mountedRef.current) {
        setError(value instanceof Error ? value.message : "Could not load WhatsApp session status.");
        setLoading(false);
      }
      throw value;
    }
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }

    const unsubs = [
      realtimeService.subscribe("qr", (payload) => {
        if (payload.sessionId !== sessionId) return;
        setSession((current) => current ? { ...current, status: "qr", qr: typeof payload.qr === "string" ? payload.qr : null } : current);
      }),
      realtimeService.subscribe("connection.update", (payload) => {
        if (payload.sessionId !== sessionId) return;
        const status = typeof payload.status === "string" ? payload.status : "";
        if (!status || status === "socket_connected" || status === "socket_disconnected") return;
        setSession((current) => {
          if (!current) return current;
          const me = payload.me && typeof payload.me === "object" ? payload.me as WhatsAppSession["me"] : undefined;
          return { ...current, status, ...(me ? { me } : {}), ...(status === "open" ? { qr: null, lastConnectedAt: new Date().toISOString() } : {}) };
        });
      }),
    ];

    void refresh().catch(() => undefined);
    return () => {
      mountedRef.current = false;
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [refresh, sessionId]);

  return { session, loading, refreshing: false, error, refresh };
}
