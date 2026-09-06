export type WhatsAppSessionStatus =
  | "pending"
  | "qr"
  | "connecting"
  | "open"
  | "close"
  | "logged_out"
  | "not_started";

export type WhatsAppSession = {
  sessionId: string;
  status: WhatsAppSessionStatus | string;
  qr: string | null;
  me: { id?: string | null; name?: string | null } | null;
  lastDisconnectReason?: string | null;
  lastConnectedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type WhatsAppChat = {
  sessionId: string;
  jid: string;
  /** Resolved real phone number when WhatsApp exposes the LID → PN mapping. */
  phoneNumber?: string | null;
  name: string;
  unreadCount: number;
  conversationTimestamp: number;
  pinned: number | boolean;
  archived: boolean;
  muteEndTime: number;
  isGroup: boolean;
  lastMessageId: string | null;
  raw: unknown;
  createdAt?: string;
  updatedAt?: string;
};

export type WhatsAppMessage = {
  sessionId: string;
  jid: string;
  messageId: string;
  fromMe: boolean;
  participant: string | null;
  messageTimestamp: number;
  status: string;
  messageType: string;
  mediaPath: string | null;
  mediaMimetype: string | null;
  quotedMessageId: string | null;
  content: unknown;
  deleted: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type WhatsAppHealth = {
  success: boolean;
  status: string;
  uptime?: number;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type WhatsAppMessageInput =
  | { type: "text"; text: string; quotedMessageId?: string; contextInfo?: Record<string, unknown> }
  | { type: "image" | "video" | "sticker"; caption?: string; mimetype?: string; fileName?: string; url?: string; quotedMessageId?: string; contextInfo?: Record<string, unknown>; gifPlayback?: boolean }
  | { type: "contact"; displayName: string; vcard: string; quotedMessageId?: string; contextInfo?: Record<string, unknown> };

export function jidToPhone(jid: string) {
  return jid.replace(/@.*$/, "");
}

function unwrapMessage(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const message = record.message;
  if (message && typeof message === "object") return message as Record<string, unknown>;
  return record;
}

export function extractMessageText(content: unknown): string {
  const message = unwrapMessage(content);
  if (!message) return "";
  for (const key of ["conversation", "text"]) {
    const value = message[key];
    if (typeof value === "string" && value) return value;
  }
  const candidates = ["extendedTextMessage", "imageMessage", "videoMessage", "documentMessage", "stickerMessage", "contactMessage", "contactsArrayMessage", "buttonsResponseMessage", "listResponseMessage", "templateButtonReplyMessage"];
  for (const key of candidates) {
    const nested = message[key];
    if (!nested || typeof nested !== "object") continue;
    const obj = nested as Record<string, unknown>;
    for (const field of ["text", "caption", "selectedDisplayText", "title", "displayName"]) {
      const value = obj[field];
      if (typeof value === "string" && value) return value;
    }
  }
  return "";
}

export function messageDate(message: WhatsAppMessage) {
  const seconds = Number(message.messageTimestamp || 0);
  return new Date(seconds > 10_000_000_000 ? seconds : seconds * 1000);
}
