import { useCallback, useEffect, useState } from "react";

import { chatService } from "../services/chat.service";
import type { WhatsAppChat } from "../core/types";

export function useWhatsAppChats(sessionId: string | null, options: { pollMs?: number } = {}) {
  const pollMs = options.pollMs ?? 4000;
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setChats([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      setError(null);
      const next = await chatService.list({ data: { sessionId } });
      setChats(next);
      return next;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp chats.";
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

  return { chats, setChats, loading, error, refresh };
}
