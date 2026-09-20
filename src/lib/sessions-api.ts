export type Session = {
  instanceName?: string;
  status?: string;
  state?: string;
  ownerJid?: string;
  profileName?: string;
  number?: string;
  tokenKnown?: boolean;
  qr?: string;
};

export type ApiResponse = {
  base64?: string;
  qrcode?: string;
  qr?: string;
  code?: string;
  message?: string;
};

export type ButtonPayload = {
  id: string;
  displayText: string;
};

export type ListRow = {
  title: string;
  rowId: string;
  description?: string;
};

export type ListSection = {
  title?: string;
  rows: ListRow[];
};

export type MediaPayload = {
  base64: string;
  mediatype: 'image' | 'video' | 'document';
  mimetype: string;
  fileName: string;
};

function backendBaseUrl() {
  const configured = String(import.meta.env.VITE_WHATSAPP_API_URL || '').trim().replace(/\/+$/, '');
  return configured || window.location.origin;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || `Request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return body as T;
}

export const sessionsApi = {
  list: () => request<Session[]>('/api/sessions'),
  create: (instanceName: string) => request('/api/sessions', { method: 'POST', body: JSON.stringify({ instanceName }) }),
  connect: (instance: string) => request<ApiResponse>(`/api/sessions/${encodeURIComponent(instance)}/connect`),
  restart: (instance: string) => request(`/api/sessions/${encodeURIComponent(instance)}/restart`, { method: 'POST' }),
  disconnect: (instance: string) => request(`/api/sessions/${encodeURIComponent(instance)}/disconnect`, { method: 'POST' }),
  remove: (instance: string) => request(`/api/sessions/${encodeURIComponent(instance)}`, { method: 'DELETE' }),
  sendText: (instance: string, number: string, text: string, options: { linkPreview?: boolean; delayMs?: number } = {}) =>
    request(`/api/sessions/${encodeURIComponent(instance)}/send-text`, { method: 'POST', body: JSON.stringify({ number, text, ...options }) }),
  sendButtons: (instance: string, number: string, payload: { title: string; description?: string; footer?: string; buttons: ButtonPayload[] }) =>
    request(`/api/sessions/${encodeURIComponent(instance)}/send-buttons`, { method: 'POST', body: JSON.stringify({ number, ...payload }) }),
  sendList: (instance: string, number: string, payload: { title: string; description?: string; footerText?: string; buttonText: string; sections: ListSection[] }) =>
    request(`/api/sessions/${encodeURIComponent(instance)}/send-list`, { method: 'POST', body: JSON.stringify({ number, ...payload }) }),
  sendMedia: (instance: string, number: string, media: MediaPayload, caption = '', delayMs = 0) =>
    request(`/api/sessions/${encodeURIComponent(instance)}/send-media`, {
      method: 'POST',
      body: JSON.stringify({ number, media, caption, delayMs }),
    }),
};
