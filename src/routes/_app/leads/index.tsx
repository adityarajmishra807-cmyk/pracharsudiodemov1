import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Plus, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, useStore, type LeadStatus } from "@/lib/store";

export const Route = createFileRoute("/_app/leads/")({
  head: () => ({
    meta: [
      { title: "Leads — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Create, filter and assign leads with status tracking and activity history in the Prachar Studio CRM.",
      },
      { property: "og:title", content: "Leads — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Your CRM pipeline: capture leads, assign owners and track status.",
      },
    ],
  }),
  component: LeadsPage,
});

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

export function LeadForm({
  onDone,
}: {
  onDone: () => void;
}) {
  const { state, addLead, isOwner } = useStore();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    source: "WhatsApp",
    status: "new" as LeadStatus,
    tags: "",
    assignedTo: isOwner ? "owner" : "",
    notes: "",
  });

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Lead name is required");
      return;
    }
    addLead({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      company: form.company.trim(),
      source: form.source,
      status: form.status,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      assignedTo: form.assignedTo || null,
      notes: form.notes.trim(),
    });
    toast.success("Lead created");
    onDone();
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="l-name">Name</Label>
          <Input
            id="l-name"
            className="h-11"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="l-phone">WhatsApp number</Label>
            <Input
              id="l-phone"
              inputMode="tel"
              className="h-11"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-email">Email</Label>
            <Input
              id="l-email"
              type="email"
              inputMode="email"
              className="h-11"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="l-company">Company</Label>
            <Input
              id="l-company"
              className="h-11"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-source">Source</Label>
            <Select
              value={form.source}
              onValueChange={(v) => setForm({ ...form, source: v })}
            >
              <SelectTrigger id="l-source" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["WhatsApp", "Website", "Referral", "Ads", "Walk-in", "Other"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="l-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}
            >
              <SelectTrigger id="l-status" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-assign">Assigned to</Label>
            <Select
              value={form.assignedTo || "unassigned"}
              onValueChange={(v) =>
                setForm({ ...form, assignedTo: v === "unassigned" ? "" : v })
              }
            >
              <SelectTrigger id="l-assign" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                {state.members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-tags">Tags</Label>
          <Input
            id="l-tags"
            className="h-11"
            placeholder="Comma separated, e.g. premium, delhi"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-notes">Notes</Label>
          <Textarea
            id="l-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>
      <DialogFooter className="mt-4 gap-2 sm:gap-2">
        <Button variant="outline" className="h-11" onClick={onDone}>
          Cancel
        </Button>
        <Button className="h-11" onClick={submit}>
          Create lead
        </Button>
      </DialogFooter>
    </>
  );
}

function LeadsPage() {
  const { state, can, memberName } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.leads.filter((lead) => {
      const matchesQuery =
        !q ||
        [lead.name, lead.phone, lead.email, lead.company, ...lead.tags]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesStatus = status === "all" || lead.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [state.leads, query, status]);

  if (!can("leadsView")) {
    return (
      <div className="space-y-5">
        <PageHeader title="Leads" />
        <EmptyState
          icon={Lock}
          title="No access to leads"
          description="Your permissions don't include viewing leads. Ask the workspace owner to enable lead access."
        />
      </div>
    );
  }

  const canCreate = can("leadsEdit");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        description="Everything you add here powers the inbox, campaigns and analytics."
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              New lead
            </Button>
          ) : null
        }
      />

      {state.leads.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-11 pl-9"
              placeholder="Search name, phone, company or tag"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search leads"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus | "all")}>
            <SelectTrigger className="h-11 sm:w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {state.leads.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No leads yet"
          description="This workspace starts empty on purpose — no sample records. Create your first lead to explore the CRM, inbox and campaign flows."
          action={
            canCreate ? (
              <Button onClick={() => setOpen(true)}>Create your first lead</Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching leads"
          description="Try a different search term or clear the status filter."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lead) => (
            <li key={lead.id}>
              <Link
                to="/leads/$leadId"
                params={{ leadId: lead.id }}
                className="block h-full rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">{lead.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {lead.company || lead.phone || "No contact details"}
                    </p>
                  </div>
                  <StatusBadge value={lead.status} />
                </div>
                {lead.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {lead.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  {lead.source} · {memberName(lead.assignedTo)} ·{" "}
                  {formatDate(lead.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
            <DialogDescription>
              Only the name is required — you can fill in the rest later.
            </DialogDescription>
          </DialogHeader>
          <LeadForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
