import { useCallback, useEffect, useState } from "react";

import { sessionService } from "../services/session.service";
import type { WhatsAppSession } from "../core/types";

export function useWhatsAppSession(sessionId: string | null, options: { pollMs?: number } = {}) {
  const pollMs = options.pollMs ?? 1500;
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      return null;
    }
    setLoading(true);
    try {
      setError(null);
      const next = await sessionService.status({ data: { sessionId } });
      setSession(next);
      return next;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp session status.";
      setError(message);
      throw value;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh().catch(() => undefined);
    if (!sessionId) return;
    const timer = window.setInterval(() => void refresh().catch(() => undefined), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, refresh, sessionId]);

  return { session, loading, error, refresh };
}
