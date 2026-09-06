import { useCallback, useEffect, useRef, useState } from "react";

import { chatService } from "../services/chat.service";
import { realtimeService } from "../services/realtime.service";
import type { WhatsAppChat } from "../core/types";

export type WhatsAppChatLoadState = "idle" | "loading" | "ready" | "error";

export function useWhatsAppChats(sessionId: string | null, _options: { pollMs?: number } = {}) {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const chatsRef = useRef<WhatsAppChat[]>([]);
  const generationRef = useRef(0);

  const apply = useCallback((next: WhatsAppChat[]) => {
    chatsRef.current = next.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0));
    if (mountedRef.current) setChats([...chatsRef.current]);
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      apply([]);
      return [];
    }
    const generation = generationRef.current;
    setLoading(true);
    try {
      const next = await chatService.list({ data: { sessionId } });
      if (generation !== generationRef.current) return next;
      apply(next);
      setError(null);
      setLoading(false);
      return next;
    } catch (value) {
      if (generation === generationRef.current) {
        setError(value instanceof Error ? value.message : "Could not load WhatsApp chats.");
        setLoading(false);
      }
      throw value;
    }
  }, [apply, sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    generationRef.current += 1;
    chatsRef.current = [];
    setChats([]);
    setError(null);
    if (!sessionId) {
      setLoading(false);
      return;
    }

    const unsubs = [
      realtimeService.subscribe("chats.upsert", (payload) => {
        if (payload.sessionId !== sessionId) return;
        const incoming = Array.isArray(payload.payload) ? payload.payload as Array<Record<string, unknown>> : [];
        const map = new Map(chatsRef.current.map((chat) => [chat.jid, chat]));
        for (const raw of incoming) {
          const jid = typeof raw.id === "string" ? raw.id : "";
          if (!jid) continue;
          const current = map.get(jid);
          map.set(jid, {
            sessionId, jid,
            name: typeof raw.name === "string" ? raw.name : current?.name || "",
            unreadCount: Number(raw.unreadCount ?? current?.unreadCount ?? 0),
            conversationTimestamp: Number(raw.conversationTimestamp ?? current?.conversationTimestamp ?? 0),
            pinned: Number(raw.pinned ?? current?.pinned ?? 0),
            archived: Boolean(raw.archived ?? current?.archived ?? false),
            muteEndTime: Number(raw.muteEndTime ?? current?.muteEndTime ?? 0),
            isGroup: typeof raw.id === "string" ? raw.id.endsWith("@g.us") : current?.isGroup || false,
            lastMessageId: typeof raw.lastMessageId === "string" ? raw.lastMessageId : current?.lastMessageId || null,
            raw,
            createdAt: current?.createdAt || null,
            updatedAt: current?.updatedAt || null,
          });
        }
        apply(Array.from(map.values()));
      }),
      realtimeService.subscribe("chats.update", (payload) => {
        if (payload.sessionId !== sessionId) return;
        const updates = Array.isArray(payload.payload) ? payload.payload as Array<Record<string, unknown>> : [];
        const map = new Map(chatsRef.current.map((chat) => [chat.jid, chat]));
        for (const raw of updates) {
          const jid = typeof raw.id === "string" ? raw.id : "";
          const current = map.get(jid);
          if (!jid || !current) continue;
          map.set(jid, {
            ...current,
            ...(raw.name !== undefined ? { name: String(raw.name) } : {}),
            ...(raw.unreadCount !== undefined ? { unreadCount: Number(raw.unreadCount) } : {}),
            ...(raw.conversationTimestamp !== undefined ? { conversationTimestamp: Number(raw.conversationTimestamp) } : {}),
            ...(raw.pinned !== undefined ? { pinned: Number(raw.pinned) } : {}),
            ...(raw.archived !== undefined ? { archived: Boolean(raw.archived) } : {}),
            ...(raw.muteEndTime !== undefined ? { muteEndTime: Number(raw.muteEndTime) } : {}),
          });
        }
        apply(Array.from(map.values()));
      }),
      realtimeService.subscribe("chats.delete", (payload) => {
        if (payload.sessionId !== sessionId) return;
        const ids = Array.isArray(payload.payload) ? payload.payload.map(String) : [];
        apply(chatsRef.current.filter((chat) => !ids.includes(chat.jid)));
      }),
      realtimeService.subscribe("messages.upsert", (payload) => {
        if (payload.sessionId !== sessionId) return;
        const incoming = Array.isArray(payload.messages) ? payload.messages as Array<Record<string, unknown>> : [];
        const map = new Map(chatsRef.current.map((chat) => [chat.jid, chat]));
        for (const message of incoming) {
          const key = message.key && typeof message.key === "object" ? message.key as Record<string, unknown> : {};
          const jid = typeof key.remoteJid === "string" ? key.remoteJid : "";
          const id = typeof key.id === "string" ? key.id : "";
          if (!jid || !id || !map.has(jid)) continue;
          const current = map.get(jid)!;
          map.set(jid, { ...current, lastMessageId: id, conversationTimestamp: Math.max(current.conversationTimestamp || 0, Number(message.messageTimestamp || 0)) });
        }
        apply(Array.from(map.values()));
      }),
    ];

    void refresh().catch(() => undefined);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [apply, refresh, sessionId]);

  const state: WhatsAppChatLoadState = error ? "error" : loading ? "loading" : chats.length ? "ready" : "idle";
  return { chats, setChats, loading, refreshing: false, error, state, refresh };
}
