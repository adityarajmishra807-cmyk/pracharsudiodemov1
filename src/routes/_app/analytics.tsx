import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Lock, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { analyticsApi, type Analytics } from "@/lib/analytics-api";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Prachar Studio" }, { name: "description", content: "Campaign delivery and performance analytics." }] }),
  component: AnalyticsPage,
});

type Days = 7 | 30 | 60 | 90;

function pct(value: number) { return `${Number(value || 0).toFixed(1)}%`; }

function AnalyticsPage() {
  const { can } = useStore();
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await analyticsApi.get(days)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load analytics."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [days]);

  const maxDaily = useMemo(() => Math.max(1, ...(data?.daily.map((d) => Math.max(d.sent, d.delivered, d.read, d.failed)) || [])), [data]);

  if (!can("analytics")) return <div className="space-y-5"><PageHeader title="Analytics" /><EmptyState icon={Lock} title="No analytics access" description="Ask the workspace owner to enable analytics for your account." /></div>;
  if (loading && !data) return <div className="space-y-5"><PageHeader title="Analytics" /><div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Loading campaign analytics…</div></div>;

  const o = data?.overview;
  if (!o) return <EmptyState icon={BarChart3} title="No analytics available" description="Create a campaign to start collecting delivery metrics." />;

  const stats = [
    ["Campaigns", o.campaigns], ["Recipients", o.totalRecipients], ["Sent", o.sent], ["Failed", o.failed],
    ["Delivered", o.delivered], ["Read", o.read], ["Delivery rate", pct(o.deliveryRate)], ["Read rate", pct(o.readRate)],
  ];

  return <div className="space-y-5">
    <PageHeader title="Analytics" description={`Campaign performance for the last ${days} days.`} actions={
      <div className="flex gap-2">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as Days)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[7,30,60,90].map((v) => <SelectItem key={v} value={String(v)}>{v} days</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /></Button>
      </div>
    } />

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map(([label,value]) => <div key={String(label)} className="rounded-lg border border-border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-navy">{value}</p></div>)}
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Delivery funnel</CardTitle></CardHeader><CardContent className="space-y-4">
        {[["Sent",o.sent],["Delivered",o.delivered],["Read",o.read],["Played",o.played],["Failed",o.failed]].map(([label,value]) => <div key={String(label)}><div className="flex justify-between text-sm"><span>{label}</span><span className="font-medium">{value}</span></div><div className="mt-1 h-2 rounded-full bg-surface"><div className="h-2 rounded-full bg-primary" style={{width:`${Math.min(100,(Number(value)/Math.max(1,o.sent))*100)}%`}} /></div></div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Campaign status</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">
        {[["Completed",o.completed],["Running",o.running],["Queued",o.queued],["Paused",o.paused],["Cancelled",o.cancelled],["Failed",o.failedCampaigns]].map(([label,value]) => <div key={String(label)} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>)}
      </CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle className="text-base">Daily activity</CardTitle></CardHeader><CardContent>
      <div className="flex h-56 items-end gap-1 overflow-x-auto">{data.daily.map((d) => <div key={d.date} className="group flex h-full min-w-5 flex-1 flex-col justify-end gap-0.5">
        <div title={`${d.date}: ${d.sent} sent`} className="mx-auto w-full rounded-t bg-primary/80" style={{height:`${(d.sent/maxDaily)*100}%`}} />
        <div title={`${d.date}: ${d.delivered} delivered`} className="mx-auto w-full bg-primary/40" style={{height:`${(d.delivered/maxDaily)*60}%`}} />
      </div>)}</div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{data.daily[0]?.date || ""}</span><span>{data.daily.at(-1)?.date || ""}</span></div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Campaign performance</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
      {!data.campaigns.length ? <p className="p-6 text-sm text-muted-foreground">No campaigns in this period.</p> :
      <table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="p-3">Campaign</th><th className="p-3">Status</th><th className="p-3">Total</th><th className="p-3">Sent</th><th className="p-3">Failed</th><th className="p-3">Delivered</th><th className="p-3">Read</th><th className="p-3">Delivery</th><th className="p-3">Read</th></tr></thead>
        <tbody>{data.campaigns.map((c) => <tr key={c.id} className="border-b last:border-0"><td className="p-3 font-medium">{c.name}<div className="text-xs text-muted-foreground">{c.type}</div></td><td className="p-3"><StatusBadge value={c.status} /></td><td className="p-3">{c.total}</td><td className="p-3">{c.sent}</td><td className="p-3">{c.failed}</td><td className="p-3">{c.delivered}</td><td className="p-3">{c.read}</td><td className="p-3">{pct(c.deliveryRate)}</td><td className="p-3">{pct(c.readRate)}</td></tr>)}</tbody>
      </table>}
    </CardContent></Card>
  </div>;
}
