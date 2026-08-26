import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  FileText,
  Inbox,
  Lock,
  Megaphone,
  MessageSquare,
  UserRound,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, useStore } from "@/lib/store";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Workspace overview of leads, WhatsApp conversations, templates, campaigns and automations in the Prachar Studio CRM.",
      },
      { property: "og:title", content: "Dashboard — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Live overview of your Prachar Studio WhatsApp CRM workspace.",
      },
    ],
  }),
  component: DashboardPage,
});

function StatCard({
  label,
  value,
  icon: Icon,
  to,
}: {
  label: string;
  value: number;
  icon: typeof UserRound;
  to?: string;
}) {
  const body = (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface text-navy">
        <Icon className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function DashboardPage() {
  const { state, isOwner, can, currentMember, memberName } = useStore();
  const { leads, conversations, templates, campaigns, automations, members } = state;

  if (!isOwner && !can("dashboard")) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={`Welcome, ${currentMember?.name ?? "member"}`}
          description="Your access is defined by the workspace owner."
        />
        <EmptyState
          icon={Lock}
          title="Dashboard access not enabled"
          description="The owner has not granted you dashboard access. Use the sections available in your navigation, or ask the owner to update your permissions."
        />
      </div>
    );
  }

  const openConversations = conversations.filter((c) => c.status === "open").length;
  const unreadLast = conversations
    .flatMap((c) => c.messages.map((m) => ({ ...m, conversation: c })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);

  const recentLeads = leads.slice(0, 5);
  const hasAnything = leads.length + conversations.length + templates.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isOwner ? "Owner dashboard" : `Welcome, ${currentMember?.name}`}
        description={
          isOwner
            ? "A live view of everything created in this workspace."
            : "Your workspace view, scoped to the permissions assigned to you."
        }
        actions={
          <>
            {can("leadsEdit") ? (
              <Button asChild>
                <Link to="/leads">
                  <UserRound className="size-4" aria-hidden="true" />
                  Create lead
                </Link>
              </Button>
            ) : null}
            {can("campaigns") ? (
              <Button asChild variant="outline">
                <Link to="/campaigns">
                  <Megaphone className="size-4" aria-hidden="true" />
                  Create campaign
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {can("leadsView") ? (
          <StatCard label="Leads" value={leads.length} icon={UserRound} to="/leads" />
        ) : null}
        {can("inboxReply") || can("inboxAssign") ? (
          <StatCard
            label="Open chats"
            value={openConversations}
            icon={MessageSquare}
            to="/inbox"
          />
        ) : null}
        {can("templatesUse") || can("templatesManage") ? (
          <StatCard
            label="Templates"
            value={templates.length}
            icon={FileText}
            to="/templates"
          />
        ) : null}
        {can("campaigns") ? (
          <StatCard
            label="Campaigns"
            value={campaigns.length}
            icon={Megaphone}
            to="/campaigns"
          />
        ) : null}
        {isOwner ? (
          <StatCard label="Team members" value={members.length} icon={Users} to="/team" />
        ) : null}
        {can("automations") ? (
          <StatCard
            label="Automations"
            value={automations.length}
            icon={Bot}
            to="/automations"
          />
        ) : null}
      </div>

      {!hasAnything ? (
        <EmptyState
          icon={Inbox}
          title="Your workspace is empty"
          description="Nothing has been created yet, so no metrics are shown. Add a lead to start building the demo — conversations, templates and campaigns will appear here as you go."
          action={
            can("leadsEdit") ? (
              <Button asChild>
                <Link to="/leads">Add your first lead</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {can("leadsView") ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Recent leads</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/leads">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentLeads.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No leads created yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {recentLeads.map((lead) => (
                      <li key={lead.id}>
                        <Link
                          to="/leads/$leadId"
                          params={{ leadId: lead.id }}
                          className="flex min-h-11 items-center justify-between gap-3 py-2.5"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {lead.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {lead.source} · {formatDate(lead.createdAt)} ·{" "}
                              {memberName(lead.assignedTo)}
                            </span>
                          </span>
                          <StatusBadge value={lead.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {can("inboxReply") || can("inboxAssign") ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Latest messages</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/inbox">Open inbox</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {unreadLast.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No messages in this workspace yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {unreadLast.map((m) => {
                      const lead = leads.find((l) => l.id === m.conversation.leadId);
                      return (
                        <li key={m.id} className="py-2.5">
                          <p className="truncate text-sm font-medium">
                            {lead?.name ?? "Contact"}
                          </p>
                          <p className="line-clamp-2 text-xs break-words text-muted-foreground">
                            {m.direction === "out" ? "You: " : ""}
                            {m.text}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
