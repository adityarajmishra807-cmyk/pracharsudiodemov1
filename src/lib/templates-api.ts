export type Template = {
  id: string;
  name: string;
  type: "text" | "media" | "media-text" | "buttons" | "list" | "media-buttons" | "media-list";
  category: string;
  status: "draft" | "approved" | "paused";
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const base = () => String(import.meta.env.VITE_WHATSAPP_API_URL || window.location.origin).replace(/\/+$/, "");

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(base() + path, {
    ...init,
    headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
  return body as T;
}

export const templatesApi = {
  list: () => request<Template[]>("/api/templates"),
  create: (payload: Record<string, unknown>) => request<Template>("/api/templates", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) => request<Template>(`/api/templates/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  remove: (id: string) => request<void>(`/api/templates/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
