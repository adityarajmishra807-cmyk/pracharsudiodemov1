import { useCallback, useEffect, useRef, useState } from "react";

import { sessionService } from "../services/session.service";
import type { WhatsAppSession } from "../core/types";

export type WhatsAppSessionLoadState = "idle" | "loading" | "refreshing" | "ready" | "error";

export function useWhatsAppSessions(options: { pollMs?: number } = {}) {
  const pollMs = options.pollMs ?? 8000;
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const sessionsRef = useRef<WhatsAppSession[]>([]);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return sessionsRef.current;
    inFlightRef.current = true;
    const initial = sessionsRef.current.length === 0;
    if (initial) setLoading(true);
    setRefreshing(true);
    try {
      setError(null);
      const next = await sessionService.list();
      sessionsRef.current = next;
      if (mountedRef.current) setSessions(next);
      return next;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp sessions.";
      if (mountedRef.current) setError(message);
      throw value;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh().catch(() => undefined);

    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (!mountedRef.current) return;
        try { await refresh(); } catch { /* state already contains the error */ }
        if (mountedRef.current) schedule();
      }, pollMs);
    };
    schedule();

    return () => {
      mountedRef.current = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [pollMs, refresh]);

  const state: WhatsAppSessionLoadState = loading ? "loading" : refreshing ? "refreshing" : error ? "error" : sessions.length ? "ready" : "idle";

  return { sessions, loading, refreshing, error, state, refresh };
}
