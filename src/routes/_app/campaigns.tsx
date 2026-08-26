import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Megaphone, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { formatDate, useStore, type Campaign, type LeadStatus } from "@/lib/store";

export const Route = createFileRoute("/_app/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Build WhatsApp broadcast campaigns: pick an audience from your leads, attach a template and track campaign status.",
      },
      { property: "og:title", content: "Campaigns — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Audience selection, template attachment and status tracking.",
      },
    ],
  }),
  component: CampaignsPage,
});

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

function CampaignsPage() {
  const { state, can, addCampaign, updateCampaign, removeCampaign } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<LeadStatus | "all">("all");
  const [templateId, setTemplateId] = useState<string>("none");

  if (!can("campaigns")) {
    return (
      <div className="space-y-5">
        <PageHeader title="Campaigns" />
        <EmptyState
          icon={Lock}
          title="No campaign access"
          description="Ask the workspace owner to enable campaigns for your account."
        />
      </div>
    );
  }

  const matchingLeads = (status: LeadStatus | "all") =>
    status === "all"
      ? state.leads
      : state.leads.filter((l) => l.status === status);

  const create = () => {
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    const leads = matchingLeads(audience);
    if (leads.length === 0) {
      toast.error("No leads match this audience yet");
      return;
    }
    addCampaign({
      name: name.trim(),
      audience: { status: audience, tag: null, leadIds: leads.map((l) => l.id) },
      templateId: templateId === "none" ? null : templateId,
      status: "draft",
    });
    toast.success("Campaign created");
    setName("");
    setAudience("all");
    setTemplateId("none");
    setOpen(false);
  };

  const advance = (campaign: Campaign) => {
    const next: Record<Campaign["status"], Campaign["status"]> = {
      draft: "scheduled",
      scheduled: "running",
      running: "completed",
      completed: "completed",
    };
    updateCampaign(campaign.id, { status: next[campaign.status] });
    toast.success(`Campaign marked ${next[campaign.status]}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campaigns"
        description="Audiences are built from the leads that exist in this workspace."
        actions={
          <Button onClick={() => setOpen(true)} disabled={state.leads.length === 0}>
            <Plus className="size-4" aria-hidden="true" />
            New campaign
          </Button>
        }
      />

      {state.leads.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Add leads before creating a campaign"
          description="A campaign needs an audience. Create at least one lead, then come back to build a broadcast."
          action={
            <Button asChild>
              <Link to="/leads">Go to leads</Link>
            </Button>
          }
        />
      ) : state.campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create a campaign to see audience size, the attached template and status progression."
          action={<Button onClick={() => setOpen(true)}>Create campaign</Button>}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {state.campaigns.map((c) => {
            const template = state.templates.find((t) => t.id === c.templateId) ?? null;
            return (
              <li key={c.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <StatusBadge value={c.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Audience</dt>
                    <dd className="font-medium capitalize">
                      {c.audience.status === "all" ? "All leads" : c.audience.status}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Recipients</dt>
                    <dd className="font-medium">{c.audience.leadIds.length}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Template</dt>
                    <dd className="truncate font-medium">
                      {template?.name ?? "No template attached"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.status !== "completed" ? (
                    <Button size="sm" onClick={() => advance(c)}>
                      {c.status === "draft"
                        ? "Schedule"
                        : c.status === "scheduled"
                          ? "Start"
                          : "Mark completed"}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      removeCampaign(c.id);
                      toast.success("Campaign deleted");
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Pick an audience segment and optionally attach a template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Campaign name</Label>
              <Input
                id="c-name"
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-aud">Audience</Label>
              <Select
                value={audience}
                onValueChange={(v) => setAudience(v as LeadStatus | "all")}
              >
                <SelectTrigger id="c-aud" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All leads ({state.leads.length})
                  </SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s} ({matchingLeads(s).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-tpl">Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger id="c-tpl" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {state.templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No templates exist yet — you can attach one later.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="h-11" onClick={create}>
              Create campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
