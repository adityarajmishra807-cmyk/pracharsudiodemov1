import { useCallback, useEffect, useRef, useState } from "react";

import { messageService } from "../services/message.service";
import { realtimeService } from "../services/realtime.service";
import type { WhatsAppMessage } from "../core/types";

export type WhatsAppMessageLoadState = "idle" | "loading" | "loadingOlder" | "ready" | "error";

function mergeMessages(current: WhatsAppMessage[], incoming: WhatsAppMessage[]) {
  const map = new Map(current.map((message) => [message.messageId, message]));
  for (const message of incoming) map.set(message.messageId, message);
  return Array.from(map.values()).sort((a, b) => a.messageTimestamp - b.messageTimestamp);
}

function fromSocketMessage(raw: Record<string, unknown>): WhatsAppMessage | null {
  const key = raw.key && typeof raw.key === "object" ? raw.key as Record<string, unknown> : {};
  const id = typeof key.id === "string" ? key.id : "";
  const jid = typeof key.remoteJid === "string" ? key.remoteJid : "";
  if (!id || !jid) return null;
  const content = raw.message && typeof raw.message === "object" ? raw.message : {};
  const messageType = Object.keys(content as Record<string, unknown>).find((key) => key !== "messageContextInfo") || "conversation";
  return {
    messageId: id,
    sessionId: String(raw.sessionId ?? ""),
    jid,
    fromMe: Boolean(key.fromMe),
    participant: typeof key.participant === "string" ? key.participant : null,
    messageTimestamp: Number(raw.messageTimestamp || Math.floor(Date.now() / 1000)),
    messageType,
    content,
    mediaMimetype: null,
    status: key.fromMe ? "sent" : "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function useWhatsAppMessages(sessionId: string | null, jid: string | null, options: { limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 20), 100);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const messagesRef = useRef<WhatsAppMessage[]>([]);
  const queueRef = useRef(Promise.resolve());

  const apply = useCallback((next: WhatsAppMessage[]) => {
    messagesRef.current = mergeMessages([], next);
    if (mountedRef.current) setMessages(messagesRef.current);
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionId || !jid) {
      apply([]);
      return [];
    }
    const generation = generationRef.current;
    setLoading(true);
    const run = async () => {
      const latest = await messageService.history({ data: { sessionId, jid, limit } });
      if (!mountedRef.current || generation !== generationRef.current) return latest;
      apply(latest);
      setHasMore(latest.length >= limit);
      setError(null);
      return latest;
    };
    const queued = queueRef.current.then(run, run);
    queueRef.current = queued.then(() => undefined, () => undefined);
    try { return await queued; }
    catch (value) {
      if (mountedRef.current && generation === generationRef.current) setError(value instanceof Error ? value.message : "Could not load WhatsApp messages.");
      throw value;
    }
    finally {
      if (mountedRef.current && generation === generationRef.current) setLoading(false);
    }
  }, [apply, jid, limit, sessionId]);

  const loadOlder = useCallback(async () => {
    const generation = generationRef.current;
    if (!sessionId || !jid || !messagesRef.current[0] || loadingOlder || !hasMore) return [];
    setLoadingOlder(true);
    const oldest = messagesRef.current[0];
    const run = async () => {
      const older = await messageService.history({ data: { sessionId, jid, before: String(oldest.messageTimestamp), limit } });
      if (!mountedRef.current || generation !== generationRef.current) return older;
      apply([...older, ...messagesRef.current]);
      setHasMore(older.length >= limit);
      setError(null);
      return older;
    };
    const queued = queueRef.current.then(run, run);
    queueRef.current = queued.then(() => undefined, () => undefined);
    try { return await queued; }
    catch (value) {
      if (mountedRef.current && generation === generationRef.current) setError(value instanceof Error ? value.message : "Could not load older WhatsApp messages.");
      throw value;
    }
    finally {
      if (mountedRef.current && generation === generationRef.current) setLoadingOlder(false);
    }
  }, [apply, hasMore, jid, limit, loadingOlder, sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    generationRef.current += 1;
    messagesRef.current = [];
    setMessages([]);
    setHasMore(true);
    setError(null);
    if (!sessionId || !jid) {
      setLoading(false);
      return;
    }

    const unsubs = [
      realtimeService.subscribe("messages.upsert", (payload) => {
        if (payload.sessionId !== sessionId || !Array.isArray(payload.messages)) return;
        const incoming = (payload.messages as Array<Record<string, unknown>>).map(fromSocketMessage).filter((m): m is WhatsAppMessage => Boolean(m && m.jid === jid));
        if (!incoming.length) return;
        apply(mergeMessages(messagesRef.current, incoming));
      }),
      realtimeService.subscribe("messages.update", (payload) => {
        if (payload.sessionId !== sessionId || !Array.isArray(payload.payload)) return;
        const map = new Map(messagesRef.current.map((message) => [message.messageId, message]));
        for (const item of payload.payload as Array<Record<string, unknown>>) {
          const key = item.key && typeof item.key === "object" ? item.key as Record<string, unknown> : {};
          if (key.remoteJid !== jid || typeof key.id !== "string") continue;
          const current = map.get(key.id);
          const update = item.update && typeof item.update === "object" ? item.update as Record<string, unknown> : {};
          if (current) map.set(key.id, { ...current, ...(update.status !== undefined ? { status: String(update.status) } : {}) });
        }
        apply(Array.from(map.values()));
      }),
      realtimeService.subscribe("messages.delete", (payload) => {
        if (payload.sessionId !== sessionId) return;
        const data = payload.payload && typeof payload.payload === "object" ? payload.payload as Record<string, unknown> : {};
        const keys = Array.isArray(data.keys) ? data.keys as Array<Record<string, unknown>> : [];
        const ids = new Set(keys.filter((key) => key.remoteJid === jid).map((key) => String(key.id)));
        if (ids.size) apply(messagesRef.current.filter((message) => !ids.has(message.messageId)));
      }),
    ];

    void refresh().catch(() => undefined);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [apply, jid, refresh, sessionId]);

  const state: WhatsAppMessageLoadState = loadingOlder ? "loadingOlder" : loading ? "loading" : error ? "error" : messages.length ? "ready" : "idle";
  return { messages, setMessages, loading, loadingOlder, refreshing: false, hasMore, error, state, refresh, loadOlder };
}
