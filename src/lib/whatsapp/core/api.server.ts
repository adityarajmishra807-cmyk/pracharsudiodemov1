import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { ApiEnvelope, WhatsAppChat, WhatsAppHealth, WhatsAppMessage, WhatsAppSession } from "./types";

// Sessions use the same Evolution API contract as the standalone Sessions implementation.
// The Evolution API key stays server-side and is never exposed to browser code.
const evolutionUrl = () =>
  (process.env.EVOLUTION_API_URL || process.env.WHATSAPP_EVOLUTION_URL || "").replace(/\/$/, "");
const evolutionKey = () => process.env.EVOLUTION_API_KEY || process.env.WHATSAPP_EVOLUTION_API_KEY || "";

// Existing gateway/BFF remains available for the Inbox implementation. Only the
// Sessions feature below is switched to Evolution directly.
const backendUrl = () => (process.env.WHATSAPP_BACKEND_URL || "").replace(/\/$/, "");
const backendKey = () => process.env.WHATSAPP_BACKEND_API_KEY || "";

const SessionId = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
const Jid = z.string().min(1).max(200);
const Pagination = z.object({ before: z.string().optional(), limit: z.number().int().min(1).max(200).optional() });
const SendText = z.object({ sessionId: SessionId, jid: Jid, text: z.string().trim().min(1).max(4096), quotedMessageId: z.string().optional() });
const ContactInput = z.object({ sessionId: SessionId, jid: Jid, displayName: z.string().trim().min(1).max(200), vcard: z.string().min(1).max(10000), quotedMessageId: z.string().optional() });
const ChatAction = z.object({ sessionId: SessionId, jid: Jid, action: z.enum(["archive", "pin", "mute", "markRead", "markUnread"]), value: z.union([z.boolean(), z.number(), z.null()]).optional() });
const ReadInput = z.object({ sessionId: SessionId, jid: Jid, messageIds: z.array(z.string().min(1)).min(1).max(100) });
const MessageAction = z.object({ sessionId: SessionId, jid: Jid, messageId: z.string().min(1).max(200) });
const MessageReaction = MessageAction.extend({ emoji: z.string().min(1).max(16) });

class WhatsAppApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "WhatsAppApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const root = backendUrl();
  if (!root) throw new WhatsAppApiError("WhatsApp backend is not configured. Set WHATSAPP_BACKEND_URL in Vercel.", 500);
  try {
    const response = await fetch(`${root}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(backendKey() ? { authorization: `Bearer ${backendKey()}` } : {}),
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => null) as (T & { error?: string; message?: string }) | null;
    if (!response.ok) throw new WhatsAppApiError(body?.error || body?.message || `WhatsApp backend returned HTTP ${response.status}`, response.status, body);
    return body as T;
  } catch (error) {
    if (error instanceof WhatsAppApiError) throw error;
    throw new WhatsAppApiError(`Could not reach WhatsApp backend at ${root}: ${error instanceof Error ? error.message : String(error)}`, 503);
  }
}

type EvolutionInstance = {
  instance?: {
    instanceName?: string;
    instanceId?: string;
    status?: string;
    connectionStatus?: string;
    owner?: string;
    profileName?: string;
    profilePictureUrl?: string;
    profilePicUrl?: string;
  };
  instanceName?: string;
  status?: string;
  connectionStatus?: string;
  owner?: string;
  profileName?: string;
  profilePictureUrl?: string;
  profilePicUrl?: string;
};

type EvolutionResponse = Record<string, unknown>;

const qrCache = new Map<string, { qr: string; expiresAt: number }>();

function requireEvolution() {
  const root = evolutionUrl();
  if (!root) throw new WhatsAppApiError("Evolution API is not configured. Set EVOLUTION_API_URL.", 500);
  return root;
}

async function evolutionRequest<T = EvolutionResponse>(path: string, init?: RequestInit): Promise<T> {
  const root = requireEvolution();
  try {
    const response = await fetch(`${root}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: evolutionKey(),
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : `Evolution API returned HTTP ${response.status}`;
      throw new WhatsAppApiError(message, response.status, body);
    }
    return body as T;
  } catch (error) {
    if (error instanceof WhatsAppApiError) throw error;
    throw new WhatsAppApiError(`Could not reach Evolution API at ${root}: ${error instanceof Error ? error.message : String(error)}`, 503);
  }
}

function evolutionStatus(value: unknown): WhatsAppSession["status"] {
  const status = String(value || "").toLowerCase();
  if (["open", "connected", "online"].includes(status)) return "open";
  if (["connecting", "pending"].includes(status)) return "connecting";
  if (["qr", "qrcode"].includes(status)) return "qr";
  if (["close", "closed", "disconnected"].includes(status)) return "close";
  if (["logged_out", "loggedout", "logout"].includes(status)) return "logged_out";
  return "not_started";
}

function normalizeInstance(raw: EvolutionInstance): WhatsAppSession {
  const instance = raw.instance || raw;
  const sessionId = String(instance.instanceName || raw.instanceName || "");
  // Evolution's fetchInstances response uses connectionStatus; some versions also expose status.
  const status = evolutionStatus(instance.connectionStatus || instance.status || raw.connectionStatus || raw.status);
  const owner = instance.owner || raw.owner || null;
  const cached = qrCache.get(sessionId);
  return {
    sessionId,
    status,
    qr: cached && cached.expiresAt > Date.now() ? cached.qr : null,
    me: owner ? { id: String(owner), name: instance.profileName || raw.profileName || null } : null,
    createdAt: undefined,
    updatedAt: undefined,
  };
}

async function evolutionConnect(sessionId: string) {
  const data = await evolutionRequest<Record<string, unknown>>(`/instance/connect/${encodeURIComponent(sessionId)}`);
  const raw = data.base64 || data.base64Url || data.qrcode || data.qr || data.code;
  if (typeof raw === "string" && raw.trim()) {
    const qr = raw.startsWith("data:image") ? raw : `data:image/png;base64,${raw}`;
    qrCache.set(sessionId, { qr, expiresAt: Date.now() + 20_000 });
  }
  return data;
}

async function listEvolutionSessions() {
  const data = await evolutionRequest<EvolutionInstance[]>("/instance/fetchInstances");
  return Array.isArray(data)
    ? data.map(normalizeInstance).filter((session) => session.sessionId)
    : [];
}

export const checkWhatsAppBackend = createServerFn({ method: "POST" }).handler(async () => {
  try {
    requireEvolution();
    await evolutionRequest("/instance/fetchInstances");
    return { success: true, status: "online" } satisfies WhatsAppHealth;
  } catch (error) {
    return { success: false, status: error instanceof Error ? error.message : "offline" } satisfies WhatsAppHealth;
  }
});

export const listWhatsAppSessions = createServerFn({ method: "POST" }).handler(listEvolutionSessions);
export const getWhatsAppRealtimeToken = createServerFn({ method: "POST" }).validator((value: unknown) => z.object({ sessionIds: z.array(SessionId).min(1).max(100) }).parse(value)).handler(async ({ data }) => ({ token: (await request<ApiEnvelope<{ token: string }>>("/api/sessions/realtime-token", { method: "POST", body: JSON.stringify({ sessionIds: data.sessionIds }) })).data.token, url: backendUrl() }));

export const startWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value))
  .handler(async ({ data }) => {
    const existing = (await listEvolutionSessions()).find((session) => session.sessionId === data.sessionId);
    if (!existing) {
      await evolutionRequest("/instance/create", {
        method: "POST",
        body: JSON.stringify({
          instanceName: data.sessionId,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });
    }
    const connect = await evolutionConnect(data.sessionId);
    return { success: true, message: typeof connect.message === "string" ? connect.message : "Connection request sent." };
  });

export const getWhatsAppSessionStatus = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value))
  .handler(async ({ data }) => {
    const response = await evolutionRequest<Record<string, unknown>>(`/instance/connectionState/${encodeURIComponent(data.sessionId)}`);
    const state = String((response.instance as Record<string, unknown> | undefined)?.state || response.state || "not_started");
    const session: WhatsAppSession = {
      sessionId: data.sessionId,
      status: evolutionStatus(state),
      qr: null,
      me: null,
    };

    const cached = qrCache.get(data.sessionId);
    if (cached && cached.expiresAt > Date.now()) session.qr = cached.qr;

    if (session.status !== "open") {
      if (!session.qr) {
        try {
          await evolutionConnect(data.sessionId);
          session.qr = qrCache.get(data.sessionId)?.qr || null;
          if (session.qr) session.status = "qr";
        } catch {
          // Connection-state polling should still return the real Evolution state.
        }
      } else {
        session.status = "qr";
      }
    } else {
      qrCache.delete(data.sessionId);
    }

    return session;
  });

export const logoutWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value))
  .handler(async ({ data }) => {
    await evolutionRequest(`/instance/logout/${encodeURIComponent(data.sessionId)}`, { method: "POST" });
    qrCache.delete(data.sessionId);
    return { success: true, message: "WhatsApp session logged out." };
  });

export const deleteWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value))
  .handler(async ({ data }) => {
    await evolutionRequest(`/instance/delete/${encodeURIComponent(data.sessionId)}`, { method: "DELETE" });
    qrCache.delete(data.sessionId);
    return { success: true, message: "WhatsApp session deleted." };
  });

// Inbox/chat operations continue to use the existing backend contract for now.
export const listWhatsAppChats = createServerFn({ method: "POST" }).validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value)).handler(async ({ data }) => (await request<ApiEnvelope<WhatsAppChat[]>>(`/api/chats/${encodeURIComponent(data.sessionId)}`)).data);
export const getWhatsAppChat = createServerFn({ method: "POST" }).validator((value: unknown) => z.object({ sessionId: SessionId, jid: Jid }).parse(value)).handler(async ({ data }) => (await request<ApiEnvelope<WhatsAppChat>>(`/api/chats/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}`)).data);
export const updateWhatsAppChat = createServerFn({ method: "POST" }).validator((value: unknown) => ChatAction.parse(value)).handler(({ data }) => request<{ success: boolean }>(`/api/chats/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}`, { method: "PATCH", body: JSON.stringify({ action: data.action, value: data.value }) }));
export const getWhatsAppHistory = createServerFn({ method: "POST" }).validator((value: unknown) => z.object({ sessionId: SessionId, jid: Jid, ...Pagination.shape }).parse(value)).handler(async ({ data }) => { const params = new URLSearchParams(); if (data.before) params.set("before", data.before); if (data.limit) params.set("limit", String(data.limit)); return (await request<ApiEnvelope<WhatsAppMessage[]>>(`/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/history${params.toString() ? `?${params}` : ""}`)).data; });
export const sendWhatsAppMessage = createServerFn({ method: "POST" }).validator((value: unknown) => SendText.parse(value)).handler(({ data }) => request<ApiEnvelope<unknown>>(`/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/send`, { method: "POST", body: JSON.stringify({ type: "text", text: data.text, ...(data.quotedMessageId ? { quotedMessageId: data.quotedMessageId } : {}) }) }));
export const sendWhatsAppMedia = createServerFn({ method: "POST" }).validator((value: unknown) => { if (!(value instanceof FormData)) throw new Error("Expected multipart FormData"); return value; }).handler(async ({ data }) => { const root = backendUrl(); if (!root) throw new WhatsAppApiError("WhatsApp backend is not configured. Set WHATSAPP_BACKEND_URL in Vercel.", 500); const sessionId = String(data.get("sessionId") || ""); const jid = String(data.get("jid") || ""); SessionId.parse(sessionId); Jid.parse(jid); const file = data.get("file"); if (!(file instanceof File)) throw new WhatsAppApiError("A media file is required.", 400); const type = String(data.get("type") || ""); if (!["image", "video", "sticker"].includes(type)) throw new WhatsAppApiError("Unsupported media type.", 400); const form = new FormData(); form.set("file", file, file.name || "upload"); form.set("type", type); if (data.get("caption")) form.set("caption", String(data.get("caption"))); if (file.type) form.set("mimetype", file.type); const response = await fetch(`${root}/api/messages/${encodeURIComponent(sessionId)}/${encodeURIComponent(jid)}/send`, { method: "POST", headers: backendKey() ? { authorization: `Bearer ${backendKey()}` } : undefined, body: form, signal: AbortSignal.timeout(120000) }); const body = await response.json().catch(() => null); if (!response.ok) throw new WhatsAppApiError(body?.error || body?.message || `WhatsApp backend returned HTTP ${response.status}`, response.status, body); return body as ApiEnvelope<unknown>; });
export const sendWhatsAppContact = createServerFn({ method: "POST" }).validator((value: unknown) => ContactInput.parse(value)).handler(({ data }) => request<ApiEnvelope<unknown>>(`/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/send`, { method: "POST", body: JSON.stringify({ type: "contact", displayName: data.displayName, vcard: data.vcard, ...(data.quotedMessageId ? { quotedMessageId: data.quotedMessageId } : {}) }) }));
export const markWhatsAppMessagesRead = createServerFn({ method: "POST" }).validator((value: unknown) => ReadInput.parse(value)).handler(({ data }) => request<{ success: boolean }>(`/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/read`, { method: "POST", body: JSON.stringify({ messageIds: data.messageIds }) }));
export const editWhatsAppMessage = createServerFn({ method: "POST" }).validator((value: unknown) => MessageAction.extend({ text: z.string().trim().min(1).max(4096) }).parse(value)).handler(({ data }) => request<ApiEnvelope<WhatsAppMessage>>(`/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/${encodeURIComponent(data.messageId)}`, { method: "PATCH", body: JSON.stringify({ text: data.text }) }));
export const deleteWhatsAppMessage = createServerFn({ method: "POST" }).validator((value: unknown) => MessageAction.parse(value)).handler(({ data }) => request<ApiEnvelope<WhatsAppMessage>>(`/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/${encodeURIComponent(data.messageId)}`, { method: "DELETE" }));
export const reactToWhatsAppMessage = createServerFn({ method: "POST" }).validator((value: unknown) => MessageReaction.parse(value)).handler(({ data }) => request<ApiEnvelope<WhatsAppMessage>>(`/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/${encodeURIComponent(data.messageId)}/react`, { method: "POST", body: JSON.stringify({ emoji: data.emoji }) }));
export const getWhatsAppMediaToken = createServerFn({ method: "POST" }).validator((value: unknown) => z.object({ sessionIds: z.array(SessionId).min(1).max(100) }).parse(value)).handler(async ({ data }) => ({ token: (await request<ApiEnvelope<{ token: string }>>("/api/sessions/realtime-token", { method: "POST", body: JSON.stringify({ sessionIds: data.sessionIds }) })).data.token, url: backendUrl() }));
export type { WhatsAppApiError };
