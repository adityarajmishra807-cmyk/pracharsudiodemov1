import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function backendUrl() {
  // Socket.IO is created in the browser, so the server-only backend URL cannot be read directly here.
  // Set VITE_WHATSAPP_BACKEND_URL to the public HTTPS backend URL for realtime events.
  return (import.meta.env.VITE_WHATSAPP_BACKEND_URL || "").replace(/\/$/, "");
}

export function getWhatsAppSocket() {
  if (typeof window === "undefined") return null;
  const root = backendUrl();
  if (!root) return null;
  if (socket) return socket;

  const apiKey = import.meta.env.VITE_WHATSAPP_BACKEND_API_KEY || "";
  socket = io(root, {
    transports: ["websocket", "polling"],
    auth: apiKey ? { token: apiKey } : undefined,
    autoConnect: true,
  });
  return socket;
}

export function joinWhatsAppSession(sessionId: string) {
  getWhatsAppSocket()?.emit("join", sessionId);
}

export function leaveWhatsAppSession(sessionId: string) {
  getWhatsAppSocket()?.emit("leave", sessionId);
}

export function closeWhatsAppSocket() {
  socket?.disconnect();
  socket = null;
}
