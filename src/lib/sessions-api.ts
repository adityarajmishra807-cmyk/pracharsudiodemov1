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

// The frontend talks only to the WhatsApp backend. It never calls Evolution API.
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
  if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
  return body as T;
}

export const sessionsApi = {
  list: () => request<Session[]>('/api/sessions'),
  create: (instanceName: string) => request('/api/sessions', { method: 'POST', body: JSON.stringify({ instanceName }) }),
  connect: (instance: string) => request<ApiResponse>(`/api/sessions/${encodeURIComponent(instance)}/connect`),
  restart: (instance: string) => request(`/api/sessions/${encodeURIComponent(instance)}/restart`, { method: 'POST' }),
  disconnect: (instance: string) => request(`/api/sessions/${encodeURIComponent(instance)}/disconnect`, { method: 'POST' }),
  remove: (instance: string) => request(`/api/sessions/${encodeURIComponent(instance)}`, { method: 'DELETE' }),
  sendText: (instance: string, number: string, text: string) => request(`/api/sessions/${encodeURIComponent(instance)}/send-text`, {
    method: 'POST',
    body: JSON.stringify({ number, text }),
  }),
};
