import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Link2,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { completeWhatsAppSignup } from "@/lib/whatsapp/meta.server";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (options: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string }; status?: string }) => void,
        options: {
          config_id: string;
          response_type: "code";
          override_default_response_type: boolean;
          extras: Record<string, unknown>;
        },
      ) => void;
    };
  }
}

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
  wabaId: string;
  phoneNumberId: string;
  qualityRating: string | null;
  lastConnectedAt: string | null;
};

const STORAGE_KEY = "prachar-whatsapp-accounts-v2";

const statusMeta: Record<SessionStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  CREATED: { label: "Created", className: "bg-surface text-muted-foreground border-border", icon: AlertCircle },
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
      { name: "description", content: "Connect and manage multiple WhatsApp Business accounts independently in Prachar Studio." },
    ],
  }),
  component: WhatsAppManagerPage,
});

function WhatsAppManagerPage() {
  const { isOwner } = useStore();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [name, setName] = useState("");
  const [sdkReady, setSdkReady] = useState(false);
  const pendingCode = useRef<string | null>(null);
  const pendingWabaId = useRef<string | null>(null);
  const pendingPhoneNumberId = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setAccounts(JSON.parse(raw) as WhatsAppAccount[]);
    } catch {
      // Ignore malformed storage.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    const appId = import.meta.env.VITE_META_APP_ID as string | undefined;
    if (!appId) return;

    const init = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: true, version: "v26.0" });
      setSdkReady(true);
    };

    if (window.FB) {
      init();
      return;
    }

    window.fbAsyncInit = init;
    const existing = document.getElementById("facebook-jssdk");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      document.body.appendChild(script);
    }

    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      let payload: unknown;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!payload || typeof payload !== "object") return;
      const data = payload as { type?: string; data?: Record<string, unknown> };
      if (data.type !== "WA_EMBEDDED_SIGNUP") return;
      const signupData = data.data ?? {};
      if (typeof signupData.waba_id === "string") pendingWabaId.current = signupData.waba_id;
      if (typeof signupData.phone_number_id === "string") pendingPhoneNumberId.current = signupData.phone_number_id;
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const selected = useMemo(
    () => accounts.find((account) => account.id === selectedId) ?? accounts[0] ?? null,
    [accounts, selectedId],
  );

  const counts = useMemo(
    () => ({
      total: accounts.length,
      ready: accounts.filter((a) => a.status === "READY").length,
      attention: accounts.filter((a) => ["DISCONNECTED", "NEEDS_RELINK", "ERROR"].includes(a.status)).length,
    }),
    [accounts],
  );

  const finishSignup = async (code: string) => {
    setConnecting(true);
    try {
      const result = await completeWhatsAppSignup({
        data: {
          code,
          wabaId: pendingWabaId.current || undefined,
          phoneNumberId: pendingPhoneNumberId.current || undefined,
        },
      });

      if (!result.connected || !result.wabaId || !result.phoneNumberId || !result.phoneNumber) {
        throw new Error(result.message || "Meta signup completed but no usable WhatsApp number was returned.");
      }

      const account: WhatsAppAccount = {
        id: crypto.randomUUID(),
        displayName: name.trim() || result.displayName || result.phoneNumber,
        phoneNumber: result.phoneNumber,
        status: "READY",
        wabaId: result.wabaId,
        phoneNumberId: result.phoneNumberId,
        qualityRating: result.qualityRating,
        lastConnectedAt: new Date().toISOString(),
      };

      setAccounts((current) => [account, ...current]);
      setSelectedId(account.id);
      setAddOpen(false);
      setName("");
      pendingCode.current = null;
      pendingWabaId.current = null;
      pendingPhoneNumberId.current = null;
      toast.success(`${account.displayName} connected successfully.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to complete WhatsApp onboarding.");
    } finally {
      setConnecting(false);
    }
  };

  const launchSignup = () => {
    const configId = import.meta.env.VITE_META_CONFIG_ID as string | undefined;
    if (!configId || !window.FB) {
      toast.error("Meta onboarding is not configured yet. Add VITE_META_APP_ID and VITE_META_CONFIG_ID in Vercel.");
      return;
    }

    pendingCode.current = null;
    pendingWabaId.current = null;
    pendingPhoneNumberId.current = null;
    setConnecting(true);

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setConnecting(false);
          toast.error("WhatsApp connection was cancelled or not completed.");
          return;
        }
        pendingCode.current = code;
        void finishSignup(code);
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: "3",
        },
      },
    );
  };

  const reconnect = () => {
    setAddOpen(true);
    setName(selected?.displayName || "");
  };

  const remove = () => {
    if (!selected) return;
    const label = selected.displayName;
    setAccounts((current) => current.filter((account) => account.id !== selected.id));
    setSelectedId(null);
    toast.success(`${label} removed from this dashboard.`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="WhatsApp Manager"
        description="Connect multiple WhatsApp Business accounts and keep every account separate."
        actions={
          <Button onClick={() => setAddOpen(true)} disabled={!isOwner}>
            <Plus className="size-4" aria-hidden="true" />
            Add WhatsApp
          </Button>
        }
      />

      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>Each connected phone number is represented as an independent account. The manager never combines conversations between accounts.</p>
        </div>
      </div>

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
              <p className="text-xs text-muted-foreground">Independent connections</p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">{accounts.length}</span>
          </div>

          {accounts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-surface text-navy">
                <Smartphone className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-3 font-semibold text-navy">No WhatsApp accounts</h3>
              <p className="mt-1 text-sm text-muted-foreground">Connect a WhatsApp Business account to get started.</p>
              <Button className="mt-4" onClick={() => setAddOpen(true)} disabled={!isOwner}>
                <Plus className="size-4" aria-hidden="true" />
                Add WhatsApp
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {accounts.map((account) => (
                <button key={account.id} type="button" onClick={() => setSelectedId(account.id)} className={cn("w-full px-4 py-3 text-left transition-colors hover:bg-surface/70", selected?.id === account.id && "bg-surface")}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white"><Phone className="size-4" aria-hidden="true" /></span>
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
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface text-navy"><Phone className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-navy">{selected.displayName}</h2>
                      <StatusPill status={selected.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{selected.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reconnect}>
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Reconnect
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Remove account" onClick={remove}>
                    <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Connection</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div><span className="font-medium text-navy">Phone ID:</span> <span className="break-all text-muted-foreground">{selected.phoneNumberId}</span></div>
                    <div><span className="font-medium text-navy">WABA ID:</span> <span className="break-all text-muted-foreground">{selected.wabaId}</span></div>
                    <div><span className="font-medium text-navy">Quality:</span> <span className="text-muted-foreground">{selected.qualityRating || "Not provided"}</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Last connected</p>
                  <p className="mt-3 font-medium text-navy">{formatLastSeen(selected.lastConnectedAt)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">The browser only receives account metadata, not the business access token.</p>
                </div>
              </div>

              <div className="border-t border-border p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-navy">Account workspace</h3>
                    <p className="mt-1 text-sm text-muted-foreground">This is the boundary for account-scoped chats, contacts, media and future message routing.</p>
                  </div>
                  <Button variant="outline" disabled>Open chats</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[26rem] items-center justify-center p-8 text-center">
              <div className="max-w-md">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface text-navy"><Smartphone className="size-6" aria-hidden="true" /></div>
                <h2 className="mt-4 text-lg font-semibold text-navy">Select a WhatsApp account</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Choose an account from the left to inspect its connection and account metadata.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => !connecting && setAddOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add WhatsApp</DialogTitle>
            <DialogDescription>Connect a WhatsApp Business number through Meta's supported Embedded Signup flow.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-name">Account label</Label>
              <Input id="wa-name" className="h-11" placeholder="e.g. Sales WhatsApp" value={name} onChange={(event) => setName(event.target.value)} disabled={connecting} />
            </div>

            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <div className="flex items-start gap-3">
                <Link2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium text-navy">Connect with Meta</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Meta will open its secure onboarding window. The business can select or create its WhatsApp Business setup and connect a phone number.</p>
                  <a className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline" href="https://www.facebook.com/business/m/whatsapp/business-platform" target="_blank" rel="noreferrer">WhatsApp Business Platform <ExternalLink className="size-3.5" aria-hidden="true" /></a>
                </div>
              </div>
            </div>

            {!import.meta.env.VITE_META_CONFIG_ID ? (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground">
                Add <strong>VITE_META_APP_ID</strong> and <strong>VITE_META_CONFIG_ID</strong> to Vercel before connecting.
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="h-11" onClick={() => setAddOpen(false)} disabled={connecting}>Cancel</Button>
            <Button className="h-11" onClick={launchSignup} disabled={connecting || !sdkReady}>
              {connecting ? "Connecting…" : "Continue with WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
