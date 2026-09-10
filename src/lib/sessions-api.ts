export type Session = { instanceName?: string; status?: string; state?: string; ownerJid?: string; profileName?: string; number?: string; tokenKnown?: boolean; qr?: string };
export type ApiResponse = { base64?: string; qrcode?: string; qr?: string; code?: string; message?: string };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
  return body as T;
}

export const sessionsApi = {
  list: () => request<Session[]>("/sessions"),
  create: (instanceName: string) => request("/sessions", { method: "POST", body: JSON.stringify({ instanceName }) }),
  connect: (instance: string) => request<ApiResponse>(`/sessions/${encodeURIComponent(instance)}/connect`),
  restart: (instance: string) => request(`/sessions/${encodeURIComponent(instance)}/restart`, { method: "POST" }),
  disconnect: (instance: string) => request(`/sessions/${encodeURIComponent(instance)}/disconnect`, { method: "POST" }),
  remove: (instance: string) => request(`/sessions/${encodeURIComponent(instance)}`, { method: "DELETE" }),
  sendText: (instance: string, number: string, text: string) => request(`/sessions/${encodeURIComponent(instance)}/send-text`, { method: "POST", body: JSON.stringify({ number, text }) }),
};
