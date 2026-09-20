import { apiRequest } from "./api";
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



async function request<T>(path: string, init: RequestInit = {}): Promise<T> { return apiRequest<T>(path, init); }

export const templatesApi = {
  list: () => request<Template[]>("/api/templates"),
  create: (payload: Record<string, unknown>) => request<Template>("/api/templates", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) => request<Template>(`/api/templates/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  remove: (id: string) => request<void>(`/api/templates/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
