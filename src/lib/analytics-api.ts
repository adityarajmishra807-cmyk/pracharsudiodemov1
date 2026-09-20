export type Analytics = {
  days: number;
  overview: {
    campaigns: number; completed: number; running: number; queued: number; paused: number; cancelled: number;
    failedCampaigns: number; totalRecipients: number; sent: number; failed: number; remaining: number;
    delivered: number; read: number; played: number; deliveryRate: number; readRate: number; failureRate: number;
  };
  daily: Array<{ date: string; sent: number; failed: number; delivered: number; read: number }>;
  campaigns: Array<{
    id: string; name: string; type: string; status: string; total: number; sent: number; failed: number;
    messageCount: number; delivered: number; read: number; deliveryRate: number; readRate: number;
  }>;
};



async function request<T>(path: string): Promise<T> {
  const response = await fetch(base() + path, { headers: { Accept: "application/json" }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
  return body as T;
}

export const analyticsApi = {
  get: (days: 7 | 30 | 60 | 90) => request<Analytics>(`/api/campaign-jobs/analytics?days=${days}`),
};
