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



async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(base() + path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
  return body as T;
}

export const audiencesApi = {
  list: () => request<Audience[]>("/api/audiences"),
  get: (id: string) => request<AudienceDetail>(`/api/audiences/${encodeURIComponent(id)}`),
};
