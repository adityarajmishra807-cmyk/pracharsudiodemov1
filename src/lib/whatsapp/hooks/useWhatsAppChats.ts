import { useCallback, useEffect, useRef, useState } from "react";

import { chatService } from "../services/chat.service";
import type { WhatsAppChat } from "../core/types";

export function useWhatsAppChats(sessionId: string | null, options: { pollMs?: number } = {}) {
  const pollMs = options.pollMs ?? 4000;
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const chatsRef = useRef<WhatsAppChat[]>([]);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      chatsRef.current = [];
      setChats([]);
      setLoading(false);
      setRefreshing(false);
      return [];
    }
    if (inFlightRef.current) return chatsRef.current;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      setError(null);
      const next = await chatService.list({ data: { sessionId } });
      chatsRef.current = next;
      if (mountedRef.current) setChats(next);
      return next;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp chats.";
      if (mountedRef.current) setError(message);
      throw value;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    inFlightRef.current = false;
    void refresh().catch(() => undefined);
    if (!sessionId) return;

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
  }, [pollMs, refresh, sessionId]);

  return { chats, setChats, loading, refreshing, error, refresh };
}
