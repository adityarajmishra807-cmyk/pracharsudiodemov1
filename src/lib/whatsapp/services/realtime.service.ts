import { io, type Socket } from "socket.io-client";

import { getWhatsAppRealtimeToken } from "../core/api.server";

export type WhatsAppRealtimeEvent =
  | "qr"
  | "connection.update"
  | "messages.upsert"
  | "messages.update"
  | "messages.delete"
  | "chats.upsert"
  | "chats.update"
  | "chats.delete"
  | "socket.error";

type EventPayload = Record<string, unknown>;
type Listener = (payload: EventPayload) => void;

class WhatsAppRealtimeService {
  private socket: Socket | null = null;
  private connectPromise: Promise<void> | null = null;
  private sessionKey = "";
  private listeners = new Map<WhatsAppRealtimeEvent, Set<Listener>>();

  async connect(sessionIds: string[]) {
    const ids = [...new Set(sessionIds)].filter(Boolean).sort();
    const key = ids.join(",");
    if (!key) {
      this.disconnect();
      return;
    }
    if (this.socket?.connected && this.sessionKey === key) return;
    if (this.connectPromise && this.sessionKey === key) return this.connectPromise;

    this.disconnect();
    this.sessionKey = key;
    this.connectPromise = (async () => {
      const { token, url } = await getWhatsAppRealtimeToken({ data: { sessionIds: ids } });
      if (!url || this.sessionKey !== key) return;

      const socket = io(url, {
        transports: ["websocket"],
        autoConnect: false,
        auth: { realtimeToken: token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
      this.socket = socket;

      const events: WhatsAppRealtimeEvent[] = [
        "qr", "connection.update", "messages.upsert", "messages.update",
        "messages.delete", "chats.upsert", "chats.update", "chats.delete", "socket.error",
      ];
      for (const event of events) {
        socket.on(event, (payload: EventPayload = {}) => this.emit(event, payload));
      }
      socket.on("connect", () => {
        for (const id of ids) socket.emit("join", id);
        this.emit("connection.update", { status: "socket_connected", sessionIds: ids });
      });
      socket.on("disconnect", (reason) => this.emit("connection.update", { status: "socket_disconnected", reason }));
      socket.on("connect_error", (error) => this.emit("socket.error", { error: error.message }));

      await new Promise<void>((resolve, reject) => {
        const onConnect = () => { cleanup(); resolve(); };
        const onError = (error: Error) => { cleanup(); reject(error); };
        const cleanup = () => {
          socket.off("connect", onConnect);
          socket.off("connect_error", onError);
        };
        socket.once("connect", onConnect);
        socket.once("connect_error", onError);
        socket.connect();
      });
    })();

    try { await this.connectPromise; } finally { this.connectPromise = null; }
  }

  subscribe(event: WhatsAppRealtimeEvent, listener: Listener) {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    return () => {
      set.delete(listener);
      if (!set.size) this.listeners.delete(event);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.sessionKey = "";
    this.connectPromise = null;
  }

  private emit(event: WhatsAppRealtimeEvent, payload: EventPayload) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}

export const realtimeService = new WhatsAppRealtimeService();
