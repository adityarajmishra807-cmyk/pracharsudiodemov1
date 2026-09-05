import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, ChevronRight, Link2, Phone, Plus, RefreshCw, ShieldCheck, Smartphone, Trash2, XCircle, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { checkWhatsAppGateway, getWhatsAppSession, reconnectWhatsAppSession, removeWhatsAppSession, startWhatsAppSession } from "@/lib/whatsapp/gateway.server";
import { cn } from "@/lib/utils";

type SessionStatus = "CREATED" | "WAITING_FOR_LINK" | "CONNECTED" | "SYNCING" | "READY" | "DISCONNECTED" | "RECONNECTING" | "NEEDS_RELINK" | "ERROR";
type WhatsAppAccount = { id: string; displayName: string; phoneNumber: string; status: SessionStatus; lastConnectedAt: string | null; lastDisconnectedAt: string | null };
const STORAGE_KEY = "prachar-whatsapp-accounts-v2";

const statusMeta: Record<SessionStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  CREATED: { label: "Created", className: "bg-surface text-muted-foreground border-border", icon: AlertCircle },
  WAITING_FOR_LINK: { label: "Scan QR", className: "bg-primary/10 text-primary border-primary/25", icon: Link2 },
  CONNECTED: { label: "Connected", className: "bg-success/10 text-success border-success/25", icon: CheckCircle2 },
  SYNCING: { label: "Syncing", className: "bg-warning/15 text-foreground border-warning/40", icon: RefreshCw },
  READY: { label: "Ready", className: "bg-success/10 text-success border-success/25", icon: CheckCircle2 },
  DISCONNECTED: { label: "Disconnected", className: "bg-destructive/10 text-destructive border-destructive/25", icon: XCircle },
  RECONNECTING: { label: "Reconnecting", className: "bg-primary/10 text-primary border-primary/25", icon: RefreshCw },
  NEEDS_RELINK: { label: "Scan QR again", className: "bg-warning/15 text-foreground border-warning/40", icon: AlertCircle },
  ERROR: { label: "Error", className: "bg-destructive/10 text-destructive border-destructive/25", icon: AlertCircle },
};

function formatDate(value: string | null) {
  if (!value) return "Never connected";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatusPill({ status }: { status: SessionStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", meta.className)}><Icon className={cn("size-3.5", status === "SYNCING" || status === "RECONNECTING" ? "animate-spin" : "")} aria-hidden="true" />{meta.label}</span>;
}

export const Route = createFileRoute("/_app/whatsapp")({
  head: () => ({ meta: [
    { title: "WhatsApp Manager — Prachar Studio" },
    { name: "description", content: "Connect multiple WhatsApp accounts by scanning a QR code." },
  ] }),
  component: WhatsAppManagerPage,
});

function WhatsAppManagerPage() {
  const { isOwner } = useStore();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<"checking" | "online" | "offline">("checking");
  const [linkOpen, setLinkOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const selected = useMemo(() => accounts.find((account) => account.id === selectedId) ?? accounts[0] ?? null, [accounts, selectedId]);

  const checkGateway = async () => {
    setGatewayStatus("checking");
    try {
      const result = await checkWhatsAppGateway({ data: undefined });
      if (!result.ok) throw new Error("Gateway health check returned not-OK.");
      setGatewayStatus("online");
      setGatewayError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach the WhatsApp gateway.";
      setGatewayStatus("offline");
      setGatewayError(message);
      return false;
    }
    return true;
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setAccounts(JSON.parse(raw) as WhatsAppAccount[]);
    } catch {
      // Ignore malformed local prototype storage.
    }
    void checkGateway();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (!linkOpen || !selected) return;
    let timer: number | undefined;
    let active = true;

    const poll = async () => {
      try {
        const result = await getWhatsAppSession({ data: { id: selected.id } });
        if (!active) return;
        setGatewayStatus("online");
        setGatewayError(result.error);
        setQr(result.qr);
        setAccounts((current) => current.map((account) => account.id === selected.id ? { ...account, status: result.status as SessionStatus, phoneNumber: result.phoneNumber || account.phoneNumber, lastConnectedAt: result.lastConnectedAt, lastDisconnectedAt: result.lastDisconnectedAt } : account));
        if (result.status === "READY") {
          setLinkOpen(false);
          setQr(null);
          toast.success(`${selected.displayName} connected.`);
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not read WhatsApp session.";
        if (active) {
          setGatewayStatus("offline");
          setGatewayError(message);
          setAccounts((current) => current.map((account) => account.id === selected.id ? { ...account, status: "ERROR" } : account));
        }
      }
      timer = window.setTimeout(poll, 1500);
    };

    void poll();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [linkOpen, selected?.id, selected?.displayName]);

  const addAccount = async () => {
    if (!isOwner) return toast.error("Only the workspace owner can add WhatsApp accounts.");
    const displayName = name.trim();
    if (!displayName) return toast.error("Account name is required.");

    const account: WhatsAppAccount = { id: crypto.randomUUID(), displayName, phoneNumber: phone.trim(), status: "CREATED", lastConnectedAt: null, lastDisconnectedAt: null };
    setAccounts((current) => [account, ...current]);
    setSelectedId(account.id);
    setName("");
    setPhone("");
    setAddOpen(false);
    setLinkOpen(true);
    setQr(null);
    setGatewayError(null);

    try {
      const result = await startWhatsAppSession({ data: { id: account.id } });
      setGatewayStatus("online");
      setGatewayError(result.error);
      setQr(result.qr);
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status: result.status as SessionStatus, phoneNumber: result.phoneNumber || item.phoneNumber } : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start WhatsApp connection";
      setGatewayStatus("offline");
      setGatewayError(message);
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status: "ERROR" } : item));
      toast.error(message);
    }
  };

  const startLinking = async () => {
    if (!selected) return;
    setLinkOpen(true);
    setQr(null);
    setGatewayError(null);
    try {
      const result = await reconnectWhatsAppSession({ data: { id: selected.id } });
      setGatewayStatus("online");
      setGatewayError(result.error);
      setQr(result.qr);
      setAccounts((current) => current.map((account) => account.id === selected.id ? { ...account, status: result.status as SessionStatus } : account));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start connection";
      setGatewayStatus("offline");
      setGatewayError(message);
      toast.error(message);
    }
  };

  const reconnect = async () => {
    if (!selected) return;
    try {
      setAccounts((current) => current.map((account) => account.id === selected.id ? { ...account, status: "RECONNECTING" } : account));
      await reconnectWhatsAppSession({ data: { id: selected.id } });
      setLinkOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reconnect";
      setGatewayStatus("offline");
      setGatewayError(message);
      toast.error(message);
    }
  };

  const remove = async () => {
    if (!selected) return;
    try {
      await removeWhatsAppSession({ data: { id: selected.id } });
    } catch {
      // Best effort cleanup for the gateway.
    }
    const label = selected.displayName;
    setAccounts((current) => current.filter((account) => account.id !== selected.id));
    setSelectedId(null);
    setQr(null);
    setGatewayError(null);
    setLinkOpen(false);
    toast.success(`${label} removed.`);
  };

  const counts = {
    total: accounts.length,
    ready: accounts.filter((account) => account.status === "READY").length,
    attention: accounts.filter((account) => ["DISCONNECTED", "RECONNECTING", "NEEDS_RELINK", "ERROR"].includes(account.status)).length,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="WhatsApp Manager" description="Connect multiple WhatsApp accounts. Scan the QR code with WhatsApp → Linked devices." actions={<Button onClick={() => setAddOpen(true)} disabled={!isOwner}><Plus className="size-4" aria-hidden="true" />Add WhatsApp</Button>} />

      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><Wifi className={cn("size-4", gatewayStatus === "online" ? "text-success" : gatewayStatus === "offline" ? "text-destructive" : "text-muted-foreground")} /><span className="text-sm font-medium text-navy">WhatsApp connection service</span><StatusPill status={gatewayStatus === "online" ? "READY" : gatewayStatus === "offline" ? "ERROR" : "CREATED"} /></div>
          <Button variant="outline" size="sm" onClick={checkGateway} disabled={gatewayStatus === "checking"}>{gatewayStatus === "checking" ? "Checking…" : "Check connection"}</Button>
        </div>
        {gatewayError ? <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm"><p className="font-medium text-destructive">Connection diagnostic</p><p className="mt-1 break-words text-destructive/90">{gatewayError}</p><p className="mt-2 text-xs text-muted-foreground">This message distinguishes a Vercel → Railway configuration problem from a WhatsApp session problem.</p></div> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Accounts</p><p className="mt-1 text-2xl font-bold text-navy">{counts.total}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Ready</p><p className="mt-1 text-2xl font-bold text-navy">{counts.ready}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Needs attention</p><p className="mt-1 text-2xl font-bold text-navy">{counts.attention}</p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3"><h2 className="font-semibold text-navy">Accounts</h2><p className="text-xs text-muted-foreground">Independent connections</p></div>
          {accounts.length ? <div className="divide-y divide-border">{accounts.map((account) => <button key={account.id} type="button" onClick={() => { setSelectedId(account.id); setQr(null); setGatewayError(null); }} className={cn("w-full px-4 py-3 text-left transition-colors hover:bg-surface/70", selected?.id === account.id && "bg-surface")}><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white"><Phone className="size-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate font-medium text-navy">{account.displayName}</span><ChevronRight className="size-4 shrink-0" /></span><span className="block text-xs text-muted-foreground">{account.phoneNumber || "Phone number appears after linking"}</span><span className="mt-2 block"><StatusPill status={account.status} /></span></span></div></button>)}</div> : <div className="px-5 py-12 text-center"><Smartphone className="mx-auto size-7 text-navy" /><p className="mt-3 font-semibold text-navy">No WhatsApp accounts</p><p className="mt-1 text-sm text-muted-foreground">Add one and scan its QR code.</p></div>}
        </section>

        <section className="rounded-xl border border-border bg-card">
          {selected ? (
            <>
              <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-navy">{selected.displayName}</h2><StatusPill status={selected.status} /></div><p className="mt-1 text-sm text-muted-foreground">{selected.phoneNumber || "Phone number will appear after QR scan"}</p></div><div className="flex gap-2">{selected.status === "READY" ? <Button variant="outline" onClick={reconnect}><RefreshCw className="size-4" />Reconnect</Button> : <Button onClick={startLinking}><Link2 className="size-4" />Show QR</Button>}<Button variant="ghost" size="icon" aria-label="Remove account" onClick={remove}><Trash2 className="size-4 text-destructive" /></Button></div></div>
              <div className="p-5"><div className="rounded-xl border border-border bg-surface p-6 text-center"><div className="mx-auto flex min-h-72 max-w-sm items-center justify-center rounded-xl bg-white p-4 shadow-sm">{qr ? <img src={qr} alt="Scan this QR code with WhatsApp Linked devices" className="size-64 max-w-full" /> : selected.status === "READY" ? <div><CheckCircle2 className="mx-auto size-10 text-success" /><p className="mt-3 font-semibold text-navy">WhatsApp connected</p></div> : gatewayError ? <div><AlertCircle className="mx-auto size-10 text-destructive" /><p className="mt-3 font-semibold text-destructive">Connection failed</p><p className="mt-2 max-w-xs break-words text-sm text-muted-foreground">{gatewayError}</p><Button className="mt-4" onClick={startLinking}>Try again</Button></div> : <div><RefreshCw className="mx-auto size-8 animate-spin text-muted-foreground" /><p className="mt-3 font-medium text-navy">Generating QR code…</p></div>}</div><p className="mt-5 text-base font-semibold text-navy">{selected.status === "READY" ? "Connected" : "Scan with WhatsApp"}</p><p className="mt-1 text-sm text-muted-foreground">On your phone: WhatsApp → Linked devices → Link a device → scan this code.</p>{selected.status !== "READY" ? <span className="mt-3 inline-flex"><StatusPill status={selected.status} /></span> : null}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-border p-4"><div className="flex gap-3"><ShieldCheck className="size-5 text-navy" /><div><p className="font-medium text-navy">Separate session</p><p className="mt-1 text-sm text-muted-foreground">Each account has its own saved linked-device session.</p></div></div></div><div className="rounded-xl border border-border p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Last connected</p><p className="mt-2 font-medium text-navy">{formatDate(selected.lastConnectedAt)}</p></div></div></div>
            </>
          ) : <div className="flex min-h-[26rem] items-center justify-center p-8 text-center"><div><Smartphone className="mx-auto size-8 text-navy" /><h2 className="mt-3 font-semibold text-navy">Select a WhatsApp account</h2></div></div>}
        </section>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add WhatsApp</DialogTitle><DialogDescription>Create an account, then scan the QR code with WhatsApp Linked devices.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-1.5"><Label htmlFor="wa-name">Account name</Label><Input id="wa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales WhatsApp" /></div><div className="space-y-1.5"><Label htmlFor="wa-phone">Phone number (optional)</Label><Input id="wa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Will be detected after linking" /></div></div><DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={addAccount}>Create &amp; show QR</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
