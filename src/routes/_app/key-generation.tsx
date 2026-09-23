import { createFileRoute } from "@tanstack/react-router";
import {
  Clipboard,
  KeyRound,
  LockKeyhole,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  generateLicenseFn,
  listLicensesFn,
  revokeLicenseFn,
} from "@/lib/server-license";
import { getAuthFn } from "@/lib/server-auth";
import type { LicenseRow } from "@/lib/server-license-store";

export const Route = createFileRoute("/_app/key-generation")({
  head: () => ({
    meta: [
      { title: "Key generation — Prachar Studio" },
      {
        name: "description",
        content:
          "Generate and manage permanent and 7-day trial license keys for Prachar Studio customers.",
      },
    ],
  }),
  component: KeyGenerationPage,
});

type DisplayLicense = LicenseRow;

function statusVariant(status: DisplayLicense["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "revoked") return "destructive";
  if (status === "expired") return "secondary";
  return "outline";
}

function statusLabel(status: DisplayLicense["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function KeyGenerationPage() {
  const [owner, setOwner] = useState(false);
  const [licenses, setLicenses] = useState<DisplayLicense[]>([]);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const auth = await getAuthFn();
      if (auth?.role !== "owner") {
        setOwner(false);
        return;
      }
      setOwner(true);
      setLicenses(await listLicensesFn());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load license keys.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!owner && !loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Key generation" />
        <EmptyState
          icon={LockKeyhole}
          title="Owner only"
          description="License key generation is restricted to the workspace owner."
        />
      </div>
    );
  }

  const filtered = licenses.filter((license) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      license.key.toLowerCase().includes(query) ||
      license.type.includes(query) ||
      license.status.includes(query) ||
      license.customer_name.toLowerCase().includes(query) ||
      license.customer_email.toLowerCase().includes(query)
    );
  });

  const active = licenses.filter((license) => license.status === "active").length;
  const unused = licenses.filter((license) => license.status === "unused").length;
  const expired = licenses.filter((license) => license.status === "expired").length;

  const generate = async (type: "permanent" | "trial") => {
    try {
      const license = await generateLicenseFn({ data: { type } });
      setLicenses((current) => [license, ...current]);
      setLastGenerated(license.key);
      void navigator.clipboard?.writeText(license.key);
      toast.success(
        type === "trial"
          ? "7-day trial key generated and copied"
          : "Permanent key generated and copied",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate key.");
    }
  };

  const revoke = async (id: string) => {
    try {
      const license = await revokeLicenseFn({ data: { id } });
      if (!license) {
        toast.error("License not found.");
        return;
      }
      setLicenses((current) =>
        current.map((item) => (item.id === id ? license : item)),
      );
      toast.success("License revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke license.");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Key generation"
        description="Create customer licenses and control their lifecycle from one place."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total keys", licenses.length],
          ["Active", active],
          ["Unused", unused],
          ["Expired", expired],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
              <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate a customer key</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Button className="h-12 justify-start gap-3" onClick={() => void generate("permanent")}>
            <KeyRound className="size-5" aria-hidden="true" />
            <span>
              <span className="block text-left font-semibold">Permanent key</span>
              <span className="block text-left text-xs font-normal opacity-75">Lifetime access after activation</span>
            </span>
          </Button>
          <Button variant="outline" className="h-12 justify-start gap-3" onClick={() => void generate("trial")}>
            <Sparkles className="size-5" aria-hidden="true" />
            <span>
              <span className="block text-left font-semibold">7-day trial key</span>
              <span className="block text-left text-xs font-normal text-muted-foreground">Countdown starts when activated</span>
            </span>
          </Button>
        </CardContent>
      </Card>

      {lastGenerated ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">New key</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold text-navy">{lastGenerated}</p>
            </div>
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => {
                void navigator.clipboard?.writeText(lastGenerated);
                toast.success("Key copied");
              }}
            >
              <Clipboard className="size-4" aria-hidden="true" />
              Copy key
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">All license keys</CardTitle>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search key, customer or status"
            className="h-10 sm:max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title={loading ? "Loading keys…" : search ? "No matching keys" : "No keys generated yet"}
              description={
                search
                  ? "Try another search term."
                  : "Generate a permanent or 7-day trial key to start selling access."
              }
              action={
                !loading && !search ? (
                  <Button onClick={() => void generate("trial")}>
                    <Plus className="size-4" aria-hidden="true" />
                    Generate first key
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {filtered.map((license) => (
                  <div key={license.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-all font-mono text-xs font-semibold text-navy">{license.key}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {license.type === "permanent" ? "Permanent" : "7-day trial"}
                        </p>
                      </div>
                      <Badge variant={statusVariant(license.status)}>{statusLabel(license.status)}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Activated</p>
                        <p className="mt-0.5 font-medium">
                          {license.activated_at ? new Date(license.activated_at).toLocaleDateString() : "Not yet"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expires</p>
                        <p className="mt-0.5 font-medium">
                          {license.expires_at ? new Date(license.expires_at).toLocaleDateString() : "Never"}
                        </p>
                      </div>
                    </div>
                    {license.customer_name || license.customer_email ? (
                      <p className="mt-3 truncate text-xs text-muted-foreground">
                        {license.customer_name || "Customer"}{license.customer_email ? " · " + license.customer_email : ""}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard?.writeText(license.key);
                          toast.success("Key copied");
                        }}
                      >
                        <Clipboard className="size-3.5" aria-hidden="true" />
                        Copy
                      </Button>
                      {license.status !== "revoked" ? (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void revoke(license.id)}>
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-lg border border-border lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>License key</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((license) => (
                      <TableRow key={license.id}>
                        <TableCell className="font-mono text-xs font-semibold">{license.key}</TableCell>
                        <TableCell>{license.type === "permanent" ? "Permanent" : "7-day trial"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(license.status)}>{statusLabel(license.status)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-56">
                          {license.customer_name || license.customer_email ? (
                            <span className="block truncate text-sm">
                              {license.customer_name || "Customer"}
                              {license.customer_email ? " · " + license.customer_email : ""}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {license.expires_at ? new Date(license.expires_at).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                void navigator.clipboard?.writeText(license.key);
                                toast.success("Key copied");
                              }}
                              aria-label={"Copy " + license.key}
                            >
                              <Clipboard className="size-4" />
                            </Button>
                            {license.status !== "revoked" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => void revoke(license.id)}
                                aria-label={"Revoke " + license.key}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex gap-3 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="text-sm leading-relaxed text-muted-foreground">
            <p className="font-semibold text-navy">License behavior</p>
            <p className="mt-1">
              A 7-day trial begins when activated. A permanent key never expires. Revoked keys are rejected by the server.
              License records are stored centrally and are not kept in browser storage.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Generated license records are independent of the local workspace demo reset.
      </p>
    </div>
  );
}
