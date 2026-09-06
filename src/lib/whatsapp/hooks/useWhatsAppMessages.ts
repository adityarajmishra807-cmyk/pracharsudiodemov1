import { useCallback, useEffect, useRef, useState } from "react";

import { messageService } from "../services/message.service";
import type { WhatsAppMessage } from "../core/types";

export type WhatsAppMessageLoadState = "idle" | "loading" | "refreshing" | "loadingOlder" | "ready" | "error";

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
  const pollMs = options.pollMs ?? 6000;
  const limit = Math.min(Math.max(options.limit ?? 100, 20), 100);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const initializedRef = useRef(false);
  const messagesRef = useRef<WhatsAppMessage[]>([]);

  // One request queue for the whole hook. This guarantees that refresh/history
  // calls never overlap, even when the selected chat changes while a request is
  // still in flight.
  const queueRef = useRef(Promise.resolve());

  const refresh = useCallback(async () => {
    const requestGeneration = generationRef.current;
    const requestSessionId = sessionId;
    const requestJid = jid;

    if (!requestSessionId || !requestJid) {
      messagesRef.current = [];
      if (mountedRef.current && requestGeneration === generationRef.current) {
        setMessages([]);
        setHasMore(false);
        setLoading(false);
        setRefreshing(false);
      }
      return [];
    }

    if (mountedRef.current && requestGeneration === generationRef.current) {
      if (!initializedRef.current) setLoading(true);
      else setRefreshing(true);
    }

    const run = async () => {
      const latest = await messageService.history({
        data: { sessionId: requestSessionId, jid: requestJid, limit },
      });

      // A response belongs only to the chat/session that requested it.
      if (!mountedRef.current || requestGeneration !== generationRef.current) return latest;

      const merged = mergeMessages(messagesRef.current, latest);
      messagesRef.current = merged;
      setMessages(merged);
      if (!initializedRef.current) {
        setHasMore(latest.length >= limit);
        initializedRef.current = true;
      }
      setError(null);
      return latest;
    };

    const queued = queueRef.current.then(run, run);
    queueRef.current = queued.then(() => undefined, () => undefined);

    try {
      return await queued;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load WhatsApp messages.";
      if (mountedRef.current && requestGeneration === generationRef.current) setError(message);
      throw value;
    } finally {
      if (mountedRef.current && requestGeneration === generationRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [jid, limit, sessionId]);

  const loadOlder = useCallback(async () => {
    const requestGeneration = generationRef.current;
    const requestSessionId = sessionId;
    const requestJid = jid;
    const oldest = messagesRef.current[0];

    if (
      !requestSessionId ||
      !requestJid ||
      !oldest ||
      loadingOlder ||
      !hasMore
    ) return [];

    if (mountedRef.current && requestGeneration === generationRef.current) setLoadingOlder(true);

    const run = async () => {
      const older = await messageService.history({
        data: {
          sessionId: requestSessionId,
          jid: requestJid,
          before: String(oldest.messageTimestamp),
          limit,
        },
      });

      if (!mountedRef.current || requestGeneration !== generationRef.current) return older;

      const merged = mergeMessages(older, messagesRef.current);
      messagesRef.current = merged;
      setMessages(merged);
      setHasMore(older.length >= limit);
      setError(null);
      return older;
    };

    const queued = queueRef.current.then(run, run);
    queueRef.current = queued.then(() => undefined, () => undefined);

    try {
      return await queued;
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not load older WhatsApp messages.";
      if (mountedRef.current && requestGeneration === generationRef.current) setError(message);
      throw value;
    } finally {
      if (mountedRef.current && requestGeneration === generationRef.current) setLoadingOlder(false);
    }
  }, [hasMore, jid, limit, loadingOlder, sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    generationRef.current += 1;
    initializedRef.current = false;
    messagesRef.current = [];

    setMessages([]);
    setHasMore(true);
    setError(null);
    setLoading(false);
    setRefreshing(false);
    setLoadingOlder(false);

    const generation = generationRef.current;
    if (!sessionId || !jid) return;

    setLoading(true);
    void refresh().catch(() => undefined);

    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (!mountedRef.current || generation !== generationRef.current) return;
        try {
          await refresh();
        } catch {
          // Error already exposed through hook state.
        }
        if (mountedRef.current && generation === generationRef.current) schedule();
      }, pollMs);
    };
    schedule();

    return () => {
      if (timer) window.clearTimeout(timer);
      // Do not cancel or reset queueRef here. An old request may still be
      // running; generation checks prevent it from mutating the new chat.
      mountedRef.current = false;
    };
  }, [jid, pollMs, refresh, sessionId]);

  const state: WhatsAppMessageLoadState =
    loadingOlder ? "loadingOlder" :
    loading ? "loading" :
    refreshing ? "refreshing" :
    error ? "error" :
    messages.length ? "ready" :
    "idle";

  return {
    messages,
    setMessages,
    loading,
    loadingOlder,
    refreshing,
    hasMore,
    error,
    state,
    refresh,
    loadOlder,
  };
}
