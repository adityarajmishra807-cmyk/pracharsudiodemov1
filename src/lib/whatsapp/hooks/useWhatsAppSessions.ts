import { useCallback, useEffect, useState } from "react";

import { sessionService } from "../services/session.service";
import type { WhatsAppSession } from "../core/types";

export function useWhatsAppSessions(options: { pollMs?: number } = {}) {
  const pollMs = options.pollMs ?? 5000;
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await sessionService.list();
      setSessions(next);
      return next;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp sessions.";
      setError(message);
      throw value;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void refresh().catch(() => undefined);
    const timer = window.setInterval(() => {
      if (mounted) void refresh().catch(() => undefined);
    }, pollMs);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [pollMs, refresh]);

  return { sessions, loading, error, refresh };
}
