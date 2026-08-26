import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PERMISSION_GROUPS, useStore, type Permissions } from "@/lib/store";

const searchSchema = z.object({ member: z.string().optional() });

export const Route = createFileRoute("/_app/permissions")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Permission management — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Grant or revoke access per member across leads, inbox, templates, campaigns, automations, analytics and settings.",
      },
      { property: "og:title", content: "Permission management — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Fine-grained, owner-controlled permissions for every team member.",
      },
    ],
  }),
  component: PermissionsPage,
});

function PermissionsPage() {
  const { state, isOwner, setMemberPermissions } = useStore();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const members = state.members;
  const selectedId = search.member ?? members[0]?.id ?? null;
  const selected = useMemo(
    () => members.find((m) => m.id === selectedId) ?? null,
    [members, selectedId],
  );
  const [dirty, setDirty] = useState<Permissions | null>(null);
  const perms = dirty ?? selected?.permissions ?? null;

  if (!isOwner) {
    return (
      <div className="space-y-5">
        <PageHeader title="Permission management" />
        <EmptyState
          icon={ShieldCheck}
          title="Owner only"
          description="Only the workspace owner can change member permissions."
        />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Permission management"
          description="Choose exactly what each member can see and do."
        />
        <EmptyState
          icon={Users}
          title="No members to configure"
          description="Add a team member first, then return here to switch individual permissions on or off."
          action={
            <Button asChild>
              <Link to="/team">Go to team management</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const toggle = (key: keyof Permissions, value: boolean) => {
    if (!perms) return;
    setDirty({ ...perms, [key]: value });
  };

  const save = () => {
    if (!selected || !dirty) return;
    setMemberPermissions(selected.id, dirty);
    setDirty(null);
    toast.success(`Permissions saved for ${selected.name}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Permission management"
        description="Access changes apply immediately the next time the member opens the workspace."
        actions={
          dirty ? (
            <>
              <Button variant="outline" onClick={() => setDirty(null)}>
                Discard
              </Button>
              <Button onClick={save}>Save changes</Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <nav
          aria-label="Team members"
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {members.map((member) => {
            const active = member.id === selectedId;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  setDirty(null);
                  void navigate({ search: { member: member.id } });
                }}
                className={`min-h-11 shrink-0 rounded-md border px-3 py-2 text-left text-sm transition-colors lg:w-full ${
                  active
                    ? "border-primary bg-primary/10 font-semibold text-navy"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                <span className="block truncate">{member.name}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {member.jobTitle || member.status}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-4">
          {PERMISSION_GROUPS.map((group) => (
            <section
              key={group.area}
              className="rounded-lg border border-border bg-card p-4"
            >
              <h2 className="text-sm font-semibold tracking-wide text-navy uppercase">
                {group.area}
              </h2>
              <ul className="mt-3 divide-y divide-border">
                {group.items.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <label
                      htmlFor={`perm-${item.key}`}
                      className="text-sm leading-snug text-foreground"
                    >
                      {item.label}
                    </label>
                    <Switch
                      id={`perm-${item.key}`}
                      checked={perms?.[item.key] ?? false}
                      onCheckedChange={(v) => toggle(item.key, v)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {dirty ? (
            <div className="sticky bottom-20 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3 lg:bottom-4">
              <p className="text-sm text-navy">Unsaved permission changes</p>
              <Button size="sm" onClick={save}>
                Save
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
