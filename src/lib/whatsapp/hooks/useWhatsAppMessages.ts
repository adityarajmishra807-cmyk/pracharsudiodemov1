import { useCallback, useEffect, useRef, useState } from "react";

import { messageService } from "../services/message.service";
import type { WhatsAppMessage } from "../core/types";

function mergeMessages(current: WhatsAppMessage[], incoming: WhatsAppMessage[]) {
  const map = new Map(current.map((message) => [message.messageId, message]));
  for (const message of incoming) map.set(message.messageId, message);
  return Array.from(map.values()).sort((a, b) => a.messageTimestamp - b.messageTimestamp);
}

export function useWhatsAppMessages(
  sessionId: string | null,
  jid: string | null,
  options: { pollMs?: number; limit?: number } = {},
) {
  const pollMs = options.pollMs ?? 2500;
  const limit = options.limit ?? 100;
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!sessionId || !jid) {
      setMessages([]);
      setHasMore(false);
      setLoading(false);
      return [];
    }

    setLoading(true);
    try {
      setError(null);
      const latest = await messageService.history({ data: { sessionId, jid, limit } });
      setMessages((current) => mergeMessages(current, latest));
      if (!initializedRef.current) {
        setHasMore(latest.length >= limit);
        initializedRef.current = true;
      }
      return latest;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp messages.";
      setError(message);
      throw value;
    } finally {
      setLoading(false);
    }
  }, [jid, limit, sessionId]);

  const loadOlder = useCallback(async () => {
    if (!sessionId || !jid || loadingOlder || !hasMore || messages.length === 0) return [];
    const oldest = messages[0];
    if (!oldest) return [];

    setLoadingOlder(true);
    try {
      setError(null);
      const older = await messageService.history({
        data: {
          sessionId,
          jid,
          before: String(oldest.messageTimestamp),
          limit,
        },
      });
      setMessages((current) => mergeMessages(older, current));
      setHasMore(older.length >= limit);
      return older;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load older WhatsApp messages.";
      setError(message);
      throw value;
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, jid, limit, loadingOlder, messages, sessionId]);

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    setError(null);
    initializedRef.current = false;
    void refresh().catch(() => undefined);
    if (!sessionId || !jid) return;
    const timer = window.setInterval(() => void refresh().catch(() => undefined), pollMs);
    return () => window.clearInterval(timer);
  }, [jid, pollMs, refresh, sessionId]);

  return {
    messages,
    setMessages,
    loading,
    loadingOlder,
    hasMore,
    error,
    refresh,
    loadOlder,
  };
}
