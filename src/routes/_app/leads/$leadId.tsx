import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/_app/leads/$leadId")({
  head: () => ({
    meta: [
      { title: "Lead details — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Lead profile with contact details, status, assignment, notes and full activity history.",
      },
      { property: "og:title", content: "Lead details — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Review and update a single lead in the Prachar Studio CRM.",
      },
    ],
  }),
  component: LeadDetailPage,
});

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

function LeadDetailPage() {
  const { leadId } = Route.useParams();
  const router = useRouter();
  const {
    state,
    can,
    updateLead,
    removeLead,
    memberName,
    startConversation,
  } = useStore();
  const lead = state.leads.find((l) => l.id === leadId) ?? null;
  const [note, setNote] = useState("");

  if (!can("leadsView") || !lead) {
    return (
      <div className="space-y-5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/leads">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to leads
          </Link>
        </Button>
        <EmptyState
          icon={UserRound}
          title={lead ? "No access to this lead" : "Lead not found"}
          description={
            lead
              ? "Your permissions don't include viewing leads."
              : "This lead may have been removed from the workspace."
          }
        />
      </div>
    );
  }

  const canEdit = can("leadsEdit");
  const conversation = state.conversations.find((c) => c.leadId === lead.id) ?? null;

  const openChat = () => {
    const convo = conversation ?? startConversation(lead.id);
    void router.navigate({ to: "/inbox", search: { c: convo.id } });
  };

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/leads">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to leads
        </Link>
      </Button>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-navy">{lead.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.source} · added {formatDate(lead.createdAt)} ·{" "}
            {memberName(lead.assignedTo)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={lead.status} />
          {can("inboxReply") ? (
            <Button size="sm" onClick={openChat}>
              <MessageSquare className="size-4" aria-hidden="true" />
              {conversation ? "Open chat" : "Start chat"}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                removeLead(lead.id);
                toast.success("Lead removed");
                void router.navigate({ to: "/leads" });
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-phone">WhatsApp number</Label>
                <Input
                  id="d-phone"
                  className="h-11"
                  inputMode="tel"
                  disabled={!canEdit}
                  value={lead.phone}
                  onChange={(e) => updateLead(lead.id, { phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-email">Email</Label>
                <Input
                  id="d-email"
                  className="h-11"
                  type="email"
                  disabled={!canEdit}
                  value={lead.email}
                  onChange={(e) => updateLead(lead.id, { email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-company">Company</Label>
                <Input
                  id="d-company"
                  className="h-11"
                  disabled={!canEdit}
                  value={lead.company}
                  onChange={(e) => updateLead(lead.id, { company: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-status">Status</Label>
                <Select
                  value={lead.status}
                  disabled={!canEdit}
                  onValueChange={(v) =>
                    updateLead(
                      lead.id,
                      { status: v as LeadStatus },
                      `Status changed to ${v}`,
                    )
                  }
                >
                  <SelectTrigger id="d-status" className="h-11 w-full">
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="d-assign">Assigned to</Label>
                <Select
                  value={lead.assignedTo ?? "unassigned"}
                  disabled={!canEdit}
                  onValueChange={(v) =>
                    updateLead(
                      lead.id,
                      { assignedTo: v === "unassigned" ? null : v },
                      `Assigned to ${v === "unassigned" ? "nobody" : memberName(v)}`,
                    )
                  }
                >
                  <SelectTrigger id="d-assign" className="h-11 w-full">
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
              <Label htmlFor="d-notes">Notes</Label>
              <Textarea
                id="d-notes"
                rows={4}
                disabled={!canEdit}
                value={lead.notes}
                onChange={(e) => updateLead(lead.id, { notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canEdit ? (
              <div className="space-y-2">
                <Label htmlFor="d-activity">Log an activity</Label>
                <Textarea
                  id="d-activity"
                  rows={2}
                  placeholder="e.g. Called and shared pricing"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!note.trim()) return;
                    updateLead(lead.id, {}, note.trim());
                    setNote("");
                    toast.success("Activity logged");
                  }}
                >
                  Add to timeline
                </Button>
              </div>
            ) : null}

            {lead.activity.length === 0 ? (
              <p className="rounded-md bg-surface p-4 text-sm leading-relaxed text-muted-foreground">
                No activity recorded yet. Status changes, assignments and your own notes
                appear here.
              </p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-4">
                {lead.activity.map((item) => (
                  <li key={item.id} className="relative">
                    <span
                      className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    <p className="text-sm break-words text-foreground">{item.text}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
