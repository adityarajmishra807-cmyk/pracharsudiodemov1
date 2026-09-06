import { useCallback, useEffect, useRef, useState } from "react";

import { chatService } from "../services/chat.service";
import type { WhatsAppChat } from "../core/types";

export type WhatsAppChatLoadState = "idle" | "loading" | "refreshing" | "ready" | "error";

export function useWhatsAppChats(sessionId: string | null, options: { pollMs?: number } = {}) {
  const pollMs = options.pollMs ?? 7000;
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const chatsRef = useRef<WhatsAppChat[]>([]);
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      chatsRef.current = [];
      if (mountedRef.current) {
        setChats([]);
        setLoading(false);
        setRefreshing(false);
        setError(null);
      }
      return [];
    }
    if (inFlightRef.current) return chatsRef.current;
    inFlightRef.current = true;
    const initial = chatsRef.current.length === 0;
    if (mountedRef.current) {
      if (initial) setLoading(true);
      setRefreshing(true);
    }
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
    generationRef.current += 1;
    const generation = generationRef.current;
    inFlightRef.current = false;
    chatsRef.current = [];
    setChats([]);
    setError(null);
    if (!sessionId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    void refresh().catch(() => undefined);

    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (!mountedRef.current || generation !== generationRef.current) return;
        try { await refresh(); } catch { /* state already contains the error */ }
        if (mountedRef.current && generation === generationRef.current) schedule();
      }, pollMs);
    };
    schedule();

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      if (timer) window.clearTimeout(timer);
    };
  }, [pollMs, refresh, sessionId]);

  const state: WhatsAppChatLoadState = loading ? "loading" : refreshing ? "refreshing" : error ? "error" : chats.length ? "ready" : "idle";

  return { chats, setChats, loading, refreshing, error, state, refresh };
}
