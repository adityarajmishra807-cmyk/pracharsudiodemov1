import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  defaultPermissions,
  formatDate,
  useStore,
  type Member,
  type Permissions,
} from "@/lib/store";

export const Route = createFileRoute("/_app/team")({
  head: () => ({
    meta: [
      { title: "Team management — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Add, edit and remove Prachar Studio team members and control their workspace access.",
      },
      { property: "og:title", content: "Team management — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Owner-only team management for the Prachar Studio workspace.",
      },
    ],
  }),
  component: TeamPage,
});

type Draft = {
  name: string;
  email: string;
  jobTitle: string;
  status: Member["status"];
  permissions: Permissions;
};

const emptyDraft: Draft = {
  name: "",
  email: "",
  jobTitle: "",
  status: "active",
  permissions: defaultPermissions,
};

function TeamPage() {
  const { state, isOwner, addMember, updateMember, removeMember } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  if (!isOwner) {
    return (
      <div className="space-y-5">
        <PageHeader title="Team management" />
        <EmptyState
          icon={ShieldCheck}
          title="Owner only"
          description="Team management is available to the workspace owner. Contact the owner if you need access changes."
        />
      </div>
    );
  }

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setOpen(true);
  };

  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setDraft({
      name: member.name,
      email: member.email,
      jobTitle: member.jobTitle,
      status: member.status,
      permissions: member.permissions,
    });
    setOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) {
      toast.error("Member name is required");
      return;
    }
    if (editingId) {
      updateMember(editingId, { ...draft, name: draft.name.trim() });
      toast.success("Member updated");
    } else {
      addMember({ ...draft, name: draft.name.trim() });
      toast.success("Member added");
    }
    setOpen(false);
  };

  const members = state.members;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team management"
        description="Create members, edit their details and control who stays active in the workspace."
        actions={
          <Button onClick={startCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Add member
          </Button>
        }
      />

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members yet"
          description="Add your first member to demonstrate permission-based access. Members you create can be reviewed from the entry screen."
          action={<Button onClick={startCreate}>Add member</Button>}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {members.map((member) => (
              <li
                key={member.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">{member.name}</p>
                    <p className="truncate text-sm break-words text-muted-foreground">
                      {member.jobTitle || "—"}
                    </p>
                    <p className="truncate text-xs break-all text-muted-foreground">
                      {member.email || "No email"}
                    </p>
                  </div>
                  <StatusBadge value={member.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Added {formatDate(member.createdAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(member)}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/permissions" search={{ member: member.id }}>
                      <ShieldCheck className="size-3.5" aria-hidden="true" />
                      Permissions
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      removeMember(member.id);
                      toast.success("Member removed");
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role / title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <span className="block font-medium">{member.name}</span>
                      <span className="block text-xs break-all text-muted-foreground">
                        {member.email || "No email"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.jobTitle || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={member.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(member)}
                          aria-label={`Edit ${member.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            to="/permissions"
                            search={{ member: member.id }}
                            aria-label={`Permissions for ${member.name}`}
                          >
                            <ShieldCheck className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            removeMember(member.id);
                            toast.success("Member removed");
                          }}
                          aria-label={`Remove ${member.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit member" : "Add member"}</DialogTitle>
            <DialogDescription>
              Members sign in from the entry screen and only see what you allow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Full name</Label>
              <Input
                id="m-name"
                className="h-11"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-email">Email</Label>
              <Input
                id="m-email"
                type="email"
                inputMode="email"
                className="h-11"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-title">Job title</Label>
              <Input
                id="m-title"
                className="h-11"
                value={draft.jobTitle}
                onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-status">Status</Label>
              <Select
                value={draft.status}
                onValueChange={(v) => setDraft({ ...draft, status: v as Member["status"] })}
              >
                <SelectTrigger id="m-status" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-md bg-surface p-3 text-xs leading-relaxed text-muted-foreground">
              Detailed access is managed in Permission Management. New members start with
              a safe default set.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="h-11" onClick={save}>
              {editingId ? "Save changes" : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
