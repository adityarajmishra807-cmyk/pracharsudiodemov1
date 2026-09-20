import { apiRequest } from "./api";
export type Audience = {
  id: string;
  name: string;
  description?: string;
  total: number;
  createdAt: string;
  updatedAt: string;
};

export type AudienceDetail = Audience & {
  recipients: Array<Record<string, string>>;
};



async function request<T>(path: string, init: RequestInit = {}): Promise<T> { return apiRequest<T>(path, init); }

export const audiencesApi = {
  list: () => request<Audience[]>("/api/audiences"),
  get: (id: string) => request<AudienceDetail>(`/api/audiences/${encodeURIComponent(id)}`),
};
