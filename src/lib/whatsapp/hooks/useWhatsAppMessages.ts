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
  const pollMs = options.pollMs ?? 5000;
  const limit = Math.min(Math.max(options.limit ?? 100, 20), 100);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const olderInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);
  const messagesRef = useRef<WhatsAppMessage[]>([]);

  const refresh = useCallback(async () => {
    if (!sessionId || !jid) {
      messagesRef.current = [];
      setMessages([]);
      setHasMore(false);
      setLoading(false);
      setRefreshing(false);
      return [];
    }
    if (inFlightRef.current || olderInFlightRef.current) return messagesRef.current;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      setError(null);
      const latest = await messageService.history({ data: { sessionId, jid, limit } });
      const merged = mergeMessages(messagesRef.current, latest);
      messagesRef.current = merged;
      if (mountedRef.current) {
        setMessages(merged);
        if (!initializedRef.current) {
          setHasMore(latest.length >= limit);
          initializedRef.current = true;
        }
      }
      return latest;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp messages.";
      if (mountedRef.current) setError(message);
      throw value;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [jid, limit, sessionId]);

  const loadOlder = useCallback(async () => {
    if (!sessionId || !jid || loadingOlder || inFlightRef.current || olderInFlightRef.current || !hasMore) return [];
    const oldest = messagesRef.current[0];
    if (!oldest) return [];

    olderInFlightRef.current = true;
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
      const merged = mergeMessages(older, messagesRef.current);
      messagesRef.current = merged;
      if (mountedRef.current) {
        setMessages(merged);
        setHasMore(older.length >= limit);
      }
      return older;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load older WhatsApp messages.";
      if (mountedRef.current) setError(message);
      throw value;
    } finally {
      olderInFlightRef.current = false;
      if (mountedRef.current) setLoadingOlder(false);
    }
  }, [hasMore, jid, limit, loadingOlder, sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    inFlightRef.current = false;
    olderInFlightRef.current = false;
    initializedRef.current = false;
    messagesRef.current = [];
    setMessages([]);
    setHasMore(true);
    setError(null);
    void refresh().catch(() => undefined);
    if (!sessionId || !jid) return;

    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (!mountedRef.current) return;
        try { await refresh(); } catch { /* surfaced through hook state */ }
        if (mountedRef.current) schedule();
      }, pollMs);
    };
    schedule();

    return () => {
      mountedRef.current = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [jid, pollMs, refresh, sessionId]);

  return {
    messages,
    setMessages,
    loading,
    loadingOlder,
    refreshing,
    hasMore,
    error,
    refresh,
    loadOlder,
  };
}
