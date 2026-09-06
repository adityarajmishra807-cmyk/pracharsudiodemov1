import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Link2, Loader2, LogOut, Phone, Plus, RefreshCw, Smartphone, Trash2, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { sessionService, useWhatsAppSession, useWhatsAppSessions, type WhatsAppSession } from "@/lib/whatsapp";

let sessionCreationInFlight = false;

export const Route = createFileRoute("/_app/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp Manager — Prachar Studio" },
      { name: "description", content: "Manage independent WhatsApp Web sessions." },
    ],
  }),
  component: WhatsAppManagerPage,
});

function statusLabel(status: string) {
  switch (status) {
    case "open": return "Ready";
    case "qr": return "Scan QR";
    case "connecting": return "Connecting";
    case "close": return "Disconnected";
    case "logged_out": return "Logged out";
    default: return "Not started";
  }
}

function statusTone(status: string) {
  switch (status) {
    case "open": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "qr": return "bg-orange-50 text-orange-700 border-orange-200";
    case "connecting": return "bg-blue-50 text-blue-700 border-blue-200";
    case "close":
    case "logged_out": return "bg-red-50 text-red-700 border-red-200";
    default: return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function StatusPill({ status }: { status: string }) {
  const busy = status === "connecting";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", statusTone(status))}>
      {status === "open" ? <CheckCircle2 className="size-3.5" /> : busy ? <RefreshCw className="size-3.5 animate-spin" /> : <AlertCircle className="size-3.5" />}
      {statusLabel(status)}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function displayName(session: WhatsAppSession, labels: Record<string, string>) {
  return labels[session.sessionId] || session.me?.name || session.me?.id?.split(":")[0] || session.sessionId;
}

function WhatsAppManagerPage() {
  const { isOwner } = useStore();
  const { sessions, loading, refreshing, error, refresh } = useWhatsAppSessions({ pollMs: 8000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<"start" | "logout" | "delete" | null>(null);

  const selected = useMemo(
    () => sessions.find((session) => session.sessionId === selectedId) ?? sessions[0] ?? null,
    [selectedId, sessions],
  );
  const detail = useWhatsAppSession(selected?.sessionId ?? null, { pollMs: 1200 });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("prachar-whatsapp-labels-v3");
      if (raw) setLabels(JSON.parse(raw) as Record<string, string>);
    } catch {
      setLabels({});
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("prachar-whatsapp-labels-v3", JSON.stringify(labels));
    } catch {
      // Presentation-only metadata.
    }
  }, [labels]);

  useEffect(() => {
    if (!selectedId && sessions[0]) setSelectedId(sessions[0].sessionId);
  }, [selectedId, sessions]);

  const createSession = async () => {
    if (sessionCreationInFlight || creating) return;
    sessionCreationInFlight = true;
    setCreating(true);
    const sessionId = `wa_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`;
    try {
      await sessionService.start({ data: { sessionId } });
      setLabels((current) => ({ ...current, [sessionId]: label.trim() || `WhatsApp ${sessions.length + 1}` }));
      setSelectedId(sessionId);
      setLabel("");
      setAddOpen(false);
      await refresh();
      toast.success("WhatsApp session started.");
    } catch (value) {
      toast.error(value instanceof Error ? value.message : "Could not start WhatsApp session.");
    } finally {
      sessionCreationInFlight = false;
      setCreating(false);
    }
  };

  const runSessionAction = async (type: "start" | "logout" | "delete") => {
    if (!selected || action) return;
    setAction(type);
    try {
      if (type === "start") await sessionService.start({ data: { sessionId: selected.sessionId } });
      if (type === "logout") await sessionService.logout({ data: { sessionId: selected.sessionId } });
      if (type === "delete") await sessionService.remove({ data: { sessionId: selected.sessionId } });

      if (type === "delete") {
        setLabels((current) => {
          const next = { ...current };
          delete next[selected.sessionId];
          return next;
        });
        setSelectedId(null);
        toast.success("WhatsApp session deleted.");
      } else if (type === "logout") {
        toast.success("WhatsApp session logged out.");
      }
      await refresh();
    } catch (value) {
      const fallback = type === "start" ? "Could not start WhatsApp session." : type === "logout" ? "Could not log out session." : "Could not delete session.";
      toast.error(value instanceof Error ? value.message : fallback);
    } finally {
      setAction(null);
    }
  };

  const status = detail.session?.status || selected?.status || "not_started";
  const readyCount = sessions.filter((session) => session.status === "open").length;
  const attentionCount = sessions.filter((session) => ["close", "logged_out"].includes(session.status)).length;
  const managerRefreshing = loading || refreshing || detail.loading || detail.refreshing;
  const canStart = Boolean(selected) && !action && !["open", "qr", "connecting"].includes(status);

  return (
    <div className="space-y-5" aria-busy={managerRefreshing || creating || Boolean(action)}>
      <PageHeader
        title="WhatsApp Manager"
        description="Manage independent WhatsApp Web sessions from the Baileys backend."
        actions={(
          <Button onClick={() => setAddOpen(true)} disabled={!isOwner || creating || sessionCreationInFlight}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {creating ? "Creating…" : "Add WhatsApp"}
          </Button>
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Wifi className={cn("size-4", error ? "text-destructive" : "text-emerald-600")} />
          <span className="text-sm font-medium text-navy">WhatsApp backend</span>
          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
            {error ? "Unavailable" : loading ? "Checking" : "Online"}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading || refreshing}>
          {loading || refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {loading || refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm break-words text-destructive">{error}</div> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">Accounts</p><p className="mt-1 text-2xl font-bold text-navy">{loading && sessions.length === 0 ? "…" : sessions.length}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">Ready</p><p className="mt-1 text-2xl font-bold text-navy">{loading && sessions.length === 0 ? "…" : readyCount}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">Needs attention</p><p className="mt-1 text-2xl font-bold text-navy">{loading && sessions.length === 0 ? "…" : attentionCount}</p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3"><p className="font-semibold text-navy">Accounts</p><p className="text-xs text-muted-foreground">Loaded from the backend</p></div>
          {loading && sessions.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center gap-2 px-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading sessions…</div>
          ) : sessions.length === 0 ? (
            <div className="px-5 py-12 text-center"><Smartphone className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-semibold text-navy">No sessions</p><p className="mt-1 text-sm text-muted-foreground">Add a WhatsApp account to begin.</p></div>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((session) => (
                <button key={session.sessionId} type="button" onClick={() => setSelectedId(session.sessionId)} className={cn("w-full px-4 py-4 text-left hover:bg-surface", selected?.sessionId === session.sessionId && "bg-surface")}>
                  <div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white"><Phone className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate font-medium text-navy">{displayName(session, labels)}</span><StatusPill status={session.status} /></div><p className="mt-1 truncate text-xs text-muted-foreground">{session.me?.id?.split(":")[0] || session.sessionId}</p></div></div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          {selected ? <>
            <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-navy">{displayName(selected, labels)}</h2><StatusPill status={status} /></div><p className="mt-1 text-sm text-muted-foreground">Session ID: {selected.sessionId}</p>{detail.session?.me?.id ? <p className="mt-1 text-sm text-muted-foreground">Phone: {detail.session.me.id.split(":")[0]}</p> : null}</div>
              <div className="flex flex-wrap gap-2">
                {status === "qr" ? <Button variant="outline" disabled><Link2 className="size-4" />Waiting for scan</Button> : null}
                {status === "connecting" ? <Button variant="outline" disabled><Loader2 className="size-4 animate-spin" />Connecting…</Button> : null}
                {status !== "qr" && status !== "connecting" ? <Button variant="outline" onClick={() => void runSessionAction("start")} disabled={!canStart || action !== null}>{action === "start" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{action === "start" ? "Starting…" : "Start"}</Button> : null}
                {status === "open" ? <Button variant="outline" onClick={() => void runSessionAction("logout")} disabled={Boolean(action)}>{action === "logout" ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}{action === "logout" ? "Logging out…" : "Log out"}</Button> : null}
                <Button variant="ghost" size="icon" aria-label="Delete session" onClick={() => void runSessionAction("delete")} disabled={Boolean(action)}>{action === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}</Button>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-surface p-6 text-center">
              <div className="mx-auto flex min-h-80 max-w-md items-center justify-center rounded-xl bg-white p-5 shadow-sm">
                {detail.loading && !detail.session ? <div className="text-center"><Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Loading session…</p></div> : detail.session?.qr ? <img src={detail.session.qr} alt="Scan this WhatsApp QR code" className="size-72 max-w-full" /> : status === "open" ? <div><CheckCircle2 className="mx-auto size-14 text-emerald-600" /><p className="mt-3 text-lg font-semibold text-navy">WhatsApp connected</p><p className="mt-1 text-sm text-muted-foreground">This number is ready for Inbox.</p></div> : <div><Link2 className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 font-medium text-navy">Waiting for QR</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Use Start once to begin the connection.</p></div>}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">WhatsApp → Linked devices → Link a device</p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Last connected</p><p className="mt-2 font-medium text-navy">{formatDate(detail.session?.lastConnectedAt)}</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Last disconnect</p><p className="mt-2 break-words font-medium text-navy">{detail.error || detail.session?.lastDisconnectReason || "None"}</p></div></div>
          </> : <div className="flex min-h-[30rem] items-center justify-center text-center"><div><Smartphone className="mx-auto size-9 text-muted-foreground" /><p className="mt-3 font-semibold text-navy">Select a WhatsApp account</p></div></div>}
        </section>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => { if (!creating) setAddOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add WhatsApp account</DialogTitle><DialogDescription>Create one persistent session in the backend. The session will not be created until you confirm.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="wa-label">Account name</Label><Input id="wa-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Sales WhatsApp" disabled={creating} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)} disabled={creating}>Cancel</Button><Button onClick={() => void createSession()} disabled={creating || sessionCreationInFlight}>{creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{creating ? "Creating…" : "Create session"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
