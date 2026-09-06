import { getWhatsAppMediaToken } from "../core/api.server";

export const mediaService = {
  token: getWhatsAppMediaToken,
  url(baseUrl: string, sessionId: string, jid: string, messageId: string, token: string) {
    const params = new URLSearchParams({ realtimeToken: token });
    return `${baseUrl.replace(/\/$/, "")}/api/media/${encodeURIComponent(sessionId)}/${encodeURIComponent(jid)}/${encodeURIComponent(messageId)}?${params.toString()}`;
  },
};
