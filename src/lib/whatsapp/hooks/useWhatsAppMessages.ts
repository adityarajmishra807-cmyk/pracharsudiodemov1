import { useCallback, useEffect, useState } from "react";

import { messageService } from "../services/message.service";
import type { WhatsAppMessage } from "../core/types";

export function useWhatsAppMessages(sessionId: string | null, jid: string | null, options: { pollMs?: number; limit?: number } = {}) {
  const pollMs = options.pollMs ?? 2500;
  const limit = options.limit ?? 100;
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId || !jid) {
      setMessages([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      setError(null);
      const next = await messageService.history({ data: { sessionId, jid, limit } });
      setMessages(next);
      return next;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp messages.";
      setError(message);
      throw value;
    } finally {
      setLoading(false);
    }
  }, [jid, limit, sessionId]);

  useEffect(() => {
    setMessages([]);
    void refresh().catch(() => undefined);
    if (!sessionId || !jid) return;
    const timer = window.setInterval(() => void refresh().catch(() => undefined), pollMs);
    return () => window.clearInterval(timer);
  }, [jid, pollMs, refresh, sessionId]);

  return { messages, setMessages, loading, error, refresh };
}
