import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Link2,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type SessionStatus =
  | "CREATED"
  | "WAITING_FOR_LINK"
  | "CONNECTED"
  | "SYNCING"
  | "READY"
  | "DISCONNECTED"
  | "RECONNECTING"
  | "NEEDS_RELINK"
  | "ERROR";

type WhatsAppAccount = {
  id: string;
  displayName: string;
  phoneNumber: string;
  status: SessionStatus;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
};

const STORAGE_KEY = "prachar-whatsapp-accounts-v1";

const statusMeta: Record<SessionStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  CREATED: { label: "Created", className: "bg-surface text-muted-foreground border-border", icon: Clock3 },
  WAITING_FOR_LINK: { label: "Waiting for link", className: "bg-primary/10 text-primary border-primary/25", icon: Link2 },
  CONNECTED: { label: "Connected", className: "bg-success/10 text-success border-success/25", icon: CheckCircle2 },
  SYNCING: { label: "Syncing", className: "bg-warning/15 text-foreground border-warning/40", icon: RefreshCw },
  READY: { label: "Ready", className: "bg-success/10 text-success border-success/25", icon: CheckCircle2 },
  DISCONNECTED: { label: "Disconnected", className: "bg-destructive/10 text-destructive border-destructive/25", icon: XCircle },
  RECONNECTING: { label: "Reconnecting", className: "bg-primary/10 text-primary border-primary/25", icon: RefreshCw },
  NEEDS_RELINK: { label: "Needs relink", className: "bg-warning/15 text-foreground border-warning/40", icon: AlertCircle },
  ERROR: { label: "Error", className: "bg-destructive/10 text-destructive border-destructive/25", icon: AlertCircle },
};

function formatLastSeen(value: string | null) {
  if (!value) return "Never connected";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatusPill({ status }: { status: SessionStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", meta.className)}>
      <Icon className={cn("size-3.5", status === "SYNCING" || status === "RECONNECTING" ? "animate-spin" : "")} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Smartphone }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-navy">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp Manager — Prachar Studio" },
      { name: "description", content: "Manage independent WhatsApp accounts and their connection sessions in Prachar Studio." },
    ],
  }),
  component: WhatsAppManagerPage,
});

function WhatsAppManagerPage() {
  const { isOwner } = useStore();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setAccounts(JSON.parse(raw) as WhatsAppAccount[]);
    } catch {
      // Ignore malformed demo storage.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts]);

  const selected = useMemo(
    () => accounts.find((account) => account.id === selectedId) ?? accounts[0] ?? null,
    [accounts, selectedId],
  );

  const counts = useMemo(
    () => ({
      total: accounts.length,
      ready: accounts.filter((a) => a.status === "READY").length,
      attention: accounts.filter((a) => ["DISCONNECTED", "RECONNECTING", "NEEDS_RELINK", "ERROR"].includes(a.status)).length,
    }),
    [accounts],
  );

  const addAccount = () => {
    if (!isOwner) {
      toast.error("Only the workspace owner can add WhatsApp accounts in this prototype.");
      return;
    }
    const displayName = name.trim();
    const phoneNumber = phone.trim();
    if (!displayName || !phoneNumber) {
      toast.error("Account name and phone number are required.");
      return;
    }

    const account: WhatsAppAccount = {
      id: Math.random().toString(36).slice(2, 10),
      displayName,
      phoneNumber,
      status: "CREATED",
      lastConnectedAt: null,
      lastDisconnectedAt: null,
    };

    setAccounts((current) => [account, ...current]);
    setSelectedId(account.id);
    setName("");
    setPhone("");
    setAddOpen(false);
    setLinkOpen(true);
  };

  const startLinking = () => {
    if (!selected) return;
    setAccounts((current) => current.map((account) => (account.id === selected.id ? { ...account, status: "WAITING_FOR_LINK" } : account)));
    setLinkOpen(true);
  };

  const simulateConnected = () => {
    if (!selected) return;
    const connectedAt = new Date().toISOString();
    setAccounts((current) => current.map((account) => (account.id === selected.id ? { ...account, status: "READY", lastConnectedAt: connectedAt } : account)));
    setLinkOpen(false);
    toast.success(`${selected.displayName} is marked ready in the prototype.`);
  };

  const reconnect = () => {
    if (!selected) return;
    setAccounts((current) => current.map((account) => (account.id === selected.id ? { ...account, status: "RECONNECTING" } : account)));
    window.setTimeout(() => {
      setAccounts((current) => current.map((account) => (account.id === selected.id ? { ...account, status: "READY", lastConnectedAt: new Date().toISOString() } : account)));
      toast.success("Connection restored in the prototype.");
    }, 700);
  };

  const remove = () => {
    if (!selected) return;
    const label = selected.displayName;
    setAccounts((current) => current.filter((account) => account.id !== selected.id));
    setSelectedId(null);
    toast.success(`${label} removed.`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="WhatsApp Manager"
        description="Connect and manage multiple WhatsApp accounts independently. Each account keeps its own session and workspace context."
        actions={
          <Button onClick={() => setAddOpen(true)} disabled={!isOwner}>
            <Plus className="size-4" aria-hidden="true" />
            Add WhatsApp
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Accounts" value={counts.total} icon={Smartphone} />
        <Stat label="Ready" value={counts.ready} icon={Wifi} />
        <Stat label="Needs attention" value={counts.attention} icon={AlertCircle} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="font-semibold text-navy">Accounts</h2>
              <p className="text-xs text-muted-foreground">Independent WhatsApp connections</p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">{accounts.length}</span>
          </div>

          {accounts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-surface text-navy">
                <Smartphone className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-3 font-semibold text-navy">No WhatsApp accounts</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add a WhatsApp account to start the linking flow.</p>
              <Button className="mt-4" onClick={() => setAddOpen(true)} disabled={!isOwner}>
                <Plus className="size-4" aria-hidden="true" />
                Add WhatsApp
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedId(account.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-surface/70",
                    selected?.id === account.id && "bg-surface",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
                      <Phone className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-navy">{account.displayName}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{account.phoneNumber}</span>
                      <span className="mt-2 block"><StatusPill status={account.status} /></span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card">
          {selected ? (
            <>
              <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface text-navy">
                    <Phone className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-navy">{selected.displayName}</h2>
                      <StatusPill status={selected.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{selected.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.status === "READY" ? (
                    <Button variant="outline" onClick={reconnect}>
                      <RefreshCw className="size-4" aria-hidden="true" />
                      Reconnect
                    </Button>
                  ) : (
                    <Button onClick={startLinking}>
                      <Link2 className="size-4" aria-hidden="true" />
                      {selected.status === "CREATED" ? "Start linking" : "Open linking"}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Remove account" onClick={remove}>
                    <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Session</p>
                  <div className="mt-3 flex items-start gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-navy">
                      <ShieldCheck className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-medium text-navy">Account-isolated session</p>
                      <p className="mt-1 text-sm text-muted-foreground">The session belongs only to this WhatsApp account.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Last connected</p>
                  <p className="mt-3 font-medium text-navy">{formatLastSeen(selected.lastConnectedAt)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.lastDisconnectedAt ? `Last disconnected ${formatLastSeen(selected.lastDisconnectedAt)}` : "No recorded disconnect"}
                  </p>
                </div>
              </div>

              <div className="border-t border-border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-navy">Account workspace</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Chats, contacts, media and message routing will remain scoped to this account.</p>
                  </div>
                  <Button variant="outline" disabled>
                    Open chats
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[26rem] items-center justify-center p-8 text-center">
              <div className="max-w-md">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface text-navy">
                  <Smartphone className="size-6" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-navy">Select a WhatsApp account</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Choose an account from the left to inspect its status and connection lifecycle.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add WhatsApp account</DialogTitle>
            <DialogDescription>Create an isolated account record first. The actual provider-generated linking / QR state will be supplied by the connection service later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-name">Display name</Label>
              <Input id="wa-name" placeholder="Sales WhatsApp" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone">Phone number</Label>
              <Input id="wa-phone" inputMode="tel" placeholder="+91 98765 43210" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addAccount}>Create and link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link {selected?.displayName ?? "WhatsApp"}</DialogTitle>
            <DialogDescription>The architecture reserves this step for the supported WhatsApp device-linking / QR provider. No raw session credentials are exposed to the browser.</DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center">
            <div className="mx-auto flex size-28 items-center justify-center rounded-xl border border-border bg-white">
              <div className="grid grid-cols-7 gap-1 opacity-45" aria-hidden="true">
                {Array.from({ length: 49 }).map((_, index) => (
                  <span key={index} className={cn("size-2 rounded-[1px]", (index * 7 + 3) % 5 < 2 ? "bg-navy" : "bg-transparent")} />
                ))}
              </div>
            </div>
            <p className="mt-4 font-medium text-navy">Linking provider slot</p>
            <p className="mt-1 text-sm text-muted-foreground">A live QR/link token will appear here once the connection layer is configured.</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Status: {selected ? statusMeta[selected.status].label : "Waiting for link"}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Close</Button>
            <Button onClick={simulateConnected} disabled={!selected}>Mark linked (prototype)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
