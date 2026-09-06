import { extractMessageText, jidToPhone, messageDate, type WhatsAppChat, type WhatsAppMessage } from "./types";

export type InboxMessage = {
  id: string;
  text: string;
  fromMe: boolean;
  status: string;
  at: Date;
  mediaType: string | null;
  mediaMimetype: string | null;
};

export type InboxChat = {
  jid: string;
  name: string;
  phoneNumber: string;
  unreadCount: number;
  isGroup: boolean;
  lastMessage: string;
  lastMessageAt: Date | null;
  conversationTimestamp: number;
};

export function toInboxChat(chat: WhatsAppChat): InboxChat {
  return {
    jid: chat.jid,
    name: chat.name || (chat.isGroup ? "Group" : jidToPhone(chat.jid)),
    phoneNumber: chat.isGroup ? "" : jidToPhone(chat.jid),
    unreadCount: chat.unreadCount || 0,
    isGroup: chat.isGroup,
    lastMessage: chat.lastMessageId ? "WhatsApp message" : "No messages yet",
    lastMessageAt: chat.conversationTimestamp ? new Date(chat.conversationTimestamp * 1000) : null,
    conversationTimestamp: chat.conversationTimestamp || 0,
  };
}

export function toInboxMessage(message: WhatsAppMessage): InboxMessage {
  return {
    id: message.messageId,
    text: extractMessageText(message.content) || (message.messageType === "imageMessage" ? "Image" : message.messageType === "videoMessage" ? "Video" : message.messageType === "audioMessage" ? "Audio" : message.messageType === "documentMessage" ? "Document" : message.messageType === "stickerMessage" ? "Sticker" : "Unsupported message"),
    fromMe: message.fromMe,
    status: message.status,
    at: messageDate(message),
    mediaType: message.messageType?.replace(/Message$/, "") || null,
    mediaMimetype: message.mediaMimetype || null,
  };
}

export function sortMessages(messages: WhatsAppMessage[]) {
  return [...messages].sort((a, b) => messageDate(a).getTime() - messageDate(b).getTime());
}
