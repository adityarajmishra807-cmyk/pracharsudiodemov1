import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link2, LogOut, RefreshCw, Search, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSessions, useSessionMutation } from "@/hooks/use-sessions";
import { sessionsApi, type Session } from "@/lib/sessions-api";

export const Route = createFileRoute("/_app/sessions")({ head: () => ({ meta: [{ title: "Sessions — Prachar Studio" }, { name: "description", content: "Manage Evolution API WhatsApp sessions." }] }), component: SessionsPage });

const state = (s: Session) => s.state || s.status || "unknown";
const online = (s: Session) => ["open", "connected", "online"].includes(state(s).toLowerCase());
const pending = (s: Session) => ["connecting", "pending", "qr"].includes(state(s).toLowerCase());
const number = (s: Session) => s.number || s.ownerJid?.split("@")[0] || "Not paired";

function Status({ session }: { session: Session }) {
  const value = state(session).toLowerCase();
  const label = online(session) ? "Connected" : pending(session) ? (value === "qr" ? "Scan QR" : "Connecting") : value === "logged_out" ? "Logged out" : "Disconnected";
  const cls = online(session) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : pending(session) ? "border-blue-200 bg-blue-50 text-blue-700" : "border-border bg-surface text-muted-foreground";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function SessionsPage() {
  const { data = [], isLoading, isFetching, refetch } = useSessions();
  const mutations = useSessionMutation();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [qr, setQr] = useState<{ instance: string; value: string } | null>(null);

  const filtered = data.filter((s) => { const q = query.toLowerCase(); return !q || String(s.instanceName || "").toLowerCase().includes(q) || number(s).includes(q); });
  const busy = mutations.restart.isPending || mutations.disconnect.isPending || mutations.remove.isPending;

  const connect = async (session: Session) => {
    try {
      const d = await sessionsApi.connect(session.instanceName!);
      const image = d.base64 || d.qrcode || d.qr || d.code;
      if (image) setQr({ instance: session.instanceName!, value: image.startsWith("data:image") ? image : `data:image/png;base64,${image}` });
      else toast.success(d.message || "Connection request sent");
      await refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not connect session"); }
  };

  const create = async () => {
    const instanceName = name.trim().toLowerCase();
    if (!instanceName) return;
    try { await mutations.create.mutateAsync(instanceName); setName(""); setCreateOpen(false); toast.success("Session created"); await refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create session"); }
  };

  const action = async (fn: () => Promise<unknown>, message: string) => { try { await fn(); toast.success(message); await refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); } };

  return <div className="space-y-5">
    <PageHeader title="Sessions" description="Manage every Evolution API instance from one workspace." actions={<Button onClick={() => setCreateOpen(true)}>+ Add session</Button>} />
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3"><Search className="size-4 text-muted-foreground" /><Input className="border-0 bg-transparent shadow-none focus-visible:ring-0" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search instances or numbers…" /></div>
      <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh</Button>
    </div>
    {isLoading ? <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Loading sessions…</div> : filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((s) => <article key={s.instanceName} className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white"><Smartphone className="size-5" /></div><div className="min-w-0"><h3 className="truncate font-semibold text-navy">{s.instanceName}</h3><p className="truncate text-sm text-muted-foreground">{s.profileName || number(s)}</p></div></div><Status session={s} /></div><div className="my-4 h-px bg-border" /><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Number</p><p className="mt-1 font-medium text-navy">{number(s)}</p></div><div><p className="text-xs text-muted-foreground">State</p><p className="mt-1 font-medium text-navy">{state(s)}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void connect(s)} disabled={busy}><Link2 className="size-4" />{online(s) ? "Status" : "Connect"}</Button><Button variant="outline" size="sm" onClick={() => void action(() => mutations.restart.mutateAsync(s.instanceName!), "Restart requested")} disabled={busy}><RefreshCw className="size-4" />Restart</Button><Button variant="outline" size="sm" onClick={() => void action(() => mutations.disconnect.mutateAsync(s.instanceName!), "Disconnected")} disabled={busy}><LogOut className="size-4" />Logout</Button><Button variant="ghost" size="sm" onClick={() => void action(() => mutations.remove.mutateAsync(s.instanceName!), "Session deleted")} disabled={busy}><Trash2 className="size-4 text-destructive" /></Button></div></article>)}</div> : <div className="rounded-xl border border-dashed border-border bg-card px-5 py-16 text-center"><Smartphone className="mx-auto size-9 text-muted-foreground" /><h3 className="mt-3 font-semibold text-navy">No matching sessions</h3><p className="mt-1 text-sm text-muted-foreground">Create a new Evolution API instance to connect WhatsApp.</p><Button className="mt-4" onClick={() => setCreateOpen(true)}>Create session</Button></div>}

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Create WhatsApp session</DialogTitle><DialogDescription>Creates a WHATSAPP-BAILEYS Evolution API instance with QR pairing.</DialogDescription></DialogHeader><Input autoFocus value={name} onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase())} placeholder="sales-01" /><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => void create()} disabled={!name.trim() || mutations.create.isPending}>{mutations.create.isPending ? "Creating…" : "Create session"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(qr)} onOpenChange={(open) => !open && setQr(null)}><DialogContent><DialogHeader><DialogTitle>Connect · {qr?.instance}</DialogTitle><DialogDescription>Scan this QR with WhatsApp → Linked devices.</DialogDescription></DialogHeader>{qr ? <div className="flex justify-center rounded-xl bg-white p-5"><img src={qr.value} alt="WhatsApp QR code" className="size-72 max-w-full" /></div> : null}<DialogFooter><Button variant="outline" onClick={() => setQr(null)}>Close</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
