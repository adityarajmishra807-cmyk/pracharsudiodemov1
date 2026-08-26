import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Lock } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore, type LeadStatus } from "@/lib/store";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Pipeline, conversation and campaign analytics calculated from the real records in your Prachar Studio workspace.",
      },
      { property: "og:title", content: "Analytics — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Real metrics from your leads, chats and campaigns — no sample data.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

function AnalyticsPage() {
  const { state, can } = useStore();

  if (!can("analytics")) {
    return (
      <div className="space-y-5">
        <PageHeader title="Analytics" />
        <EmptyState
          icon={Lock}
          title="No analytics access"
          description="Ask the workspace owner to enable analytics for your account."
        />
      </div>
    );
  }

  const { leads, conversations, campaigns } = state;
  const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
  const outbound = conversations.reduce(
    (sum, c) => sum + c.messages.filter((m) => m.direction === "out").length,
    0,
  );
  const won = leads.filter((l) => l.status === "won").length;
  const conversion = leads.length ? Math.round((won / leads.length) * 100) : 0;
  const maxStatus = Math.max(
    1,
    ...STATUSES.map((s) => leads.filter((l) => l.status === s).length),
  );

  if (leads.length === 0 && conversations.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Analytics"
          description="Every number here is computed from records you create."
        />
        <EmptyState
          icon={BarChart3}
          title="Nothing to measure yet"
          description="Analytics stay empty until real leads and conversations exist — no placeholder charts. Add a lead to get started."
          action={
            <Button asChild>
              <Link to="/leads">Go to leads</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const stats = [
    { label: "Total leads", value: leads.length },
    { label: "Won leads", value: won },
    { label: "Conversion", value: `${conversion}%` },
    { label: "Conversations", value: conversations.length },
    { label: "Messages", value: totalMessages },
    { label: "Sent by team", value: outbound },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Computed live from the leads, chats and campaigns in this workspace."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-navy">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline by status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STATUSES.map((s) => {
              const count = leads.filter((l) => l.status === s).length;
              return (
                <div key={s}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{s}</span>
                    <span className="font-medium text-navy">{count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(count / maxStatus) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign status</CardTitle>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No campaigns created yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(["draft", "scheduled", "running", "completed"] as const).map((s) => (
                  <li key={s} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="capitalize">{s}</span>
                    <span className="font-medium text-navy">
                      {campaigns.filter((c) => c.status === s).length}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
