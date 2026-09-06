import { useCallback, useEffect, useRef, useState } from "react";

import { sessionService } from "../services/session.service";
import { realtimeService } from "../services/realtime.service";
import type { WhatsAppSession } from "../core/types";

export type WhatsAppSessionLoadState = "idle" | "loading" | "ready" | "error";

export function useWhatsAppSessions() {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const sessionsRef = useRef<WhatsAppSession[]>([]);

  const applySessions = useCallback((next: WhatsAppSession[]) => {
    sessionsRef.current = next;
    if (mountedRef.current) setSessions(next);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await sessionService.list();
      applySessions(next);
      if (mountedRef.current) {
        setError(null);
        setLoading(false);
      }
      await realtimeService.connect(next.map((session) => session.sessionId));
      return next;
    } catch (value) {
      if (mountedRef.current) {
        setError(value instanceof Error ? value.message : "Could not load WhatsApp sessions.");
        setLoading(false);
      }
      throw value;
    }
  }, [applySessions]);

  useEffect(() => {
    mountedRef.current = true;
    const unsubs = [
      realtimeService.subscribe("qr", (payload) => {
        const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
        if (!sessionId) return;
        const next = sessionsRef.current.map((s) => s.sessionId === sessionId ? { ...s, status: "qr", qr: typeof payload.qr === "string" ? payload.qr : null } : s);
        applySessions(next);
      }),
      realtimeService.subscribe("connection.update", (payload) => {
        const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
        const status = typeof payload.status === "string" ? payload.status : "";
        if (!sessionId || status === "socket_connected" || status === "socket_disconnected") return;
        const me = payload.me && typeof payload.me === "object" ? payload.me as WhatsAppSession["me"] : undefined;
        applySessions(sessionsRef.current.map((s) => s.sessionId === sessionId ? { ...s, status, ...(me ? { me } : {}), ...(status === "open" ? { qr: null, lastConnectedAt: new Date().toISOString() } : {}) } : s));
      }),
    ];
    void refresh().catch(() => undefined);
    return () => {
      mountedRef.current = false;
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [applySessions, refresh]);

  const state: WhatsAppSessionLoadState = error ? "error" : loading ? "loading" : sessions.length ? "ready" : "idle";
  return { sessions, loading, refreshing: false, error, state, refresh };
}
