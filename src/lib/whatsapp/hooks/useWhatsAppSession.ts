import { useCallback, useEffect, useRef, useState } from "react";

import { sessionService } from "../services/session.service";
import type { WhatsAppSession } from "../core/types";

export function useWhatsAppSession(sessionId: string | null, options: { pollMs?: number } = {}) {
  const pollMs = options.pollMs ?? 1500;
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      if (mountedRef.current) {
        setSession(null);
        setLoading(false);
        setRefreshing(false);
        setError(null);
      }
      return null;
    }
    if (inFlightRef.current) return session;

    inFlightRef.current = true;
    if (mountedRef.current) {
      if (session) setRefreshing(true);
      else setLoading(true);
    }

    try {
      setError(null);
      const next = await sessionService.status({ data: { sessionId } });
      if (mountedRef.current) setSession(next);
      return next;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp session status.";
      if (mountedRef.current) setError(message);
      throw value;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [session, sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    generationRef.current += 1;
    const generation = generationRef.current;
    inFlightRef.current = false;
    setSession(null);
    setError(null);

    if (!sessionId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    void refresh().catch(() => undefined);

    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (!mountedRef.current || generation !== generationRef.current) return;
        try {
          const next = await refresh();
          // Once the session is actually ready, status polling can be relaxed substantially.
          // During QR/connecting states we poll faster so the UI transitions promptly.
          const nextPollMs = next?.status === "open" ? Math.max(pollMs, 15000) : pollMs;
          if (mountedRef.current && generation === generationRef.current) {
            timer = window.setTimeout(schedule, nextPollMs);
          }
          return;
        } catch {
          if (mountedRef.current && generation === generationRef.current) {
            timer = window.setTimeout(schedule, Math.max(pollMs * 2, 5000));
          }
        }
      }, pollMs);
    };
    schedule();

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      if (timer) window.clearTimeout(timer);
    };
  }, [pollMs, refresh, sessionId]);

  return { session, loading, refreshing, error, refresh };
}
