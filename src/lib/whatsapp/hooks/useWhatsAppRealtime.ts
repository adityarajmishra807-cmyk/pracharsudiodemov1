import { useEffect } from "react";

import { getWhatsAppSocket, joinWhatsAppSession, leaveWhatsAppSession } from "../core/socket.client";

export type WhatsAppRealtimeEvent =
  | { type: "qr"; payload: unknown }
  | { type: "connection.update"; payload: unknown }
  | { type: "messages.upsert"; payload: unknown }
  | { type: "messages.update"; payload: unknown }
  | { type: "chats.upsert"; payload: unknown }
  | { type: "presence.update"; payload: unknown };

export function useWhatsAppRealtime(
  sessionId: string | null,
  onEvent?: (event: WhatsAppRealtimeEvent) => void,
) {
  useEffect(() => {
    if (!sessionId) return;
    const socket = getWhatsAppSocket();
    if (!socket) return;

    const handlers: Array<[string, (payload: unknown) => void]> = [
      ["qr", (payload) => onEvent?.({ type: "qr", payload })],
      ["connection.update", (payload) => onEvent?.({ type: "connection.update", payload })],
      ["messages.upsert", (payload) => onEvent?.({ type: "messages.upsert", payload })],
      ["messages.update", (payload) => onEvent?.({ type: "messages.update", payload })],
      ["chats.upsert", (payload) => onEvent?.({ type: "chats.upsert", payload })],
      ["presence.update", (payload) => onEvent?.({ type: "presence.update", payload })],
    ];

    for (const [event, handler] of handlers) socket.on(event, handler);
    joinWhatsAppSession(sessionId);

    return () => {
      leaveWhatsAppSession(sessionId);
      for (const [event, handler] of handlers) socket.off(event, handler);
    };
  }, [onEvent, sessionId]);
}
