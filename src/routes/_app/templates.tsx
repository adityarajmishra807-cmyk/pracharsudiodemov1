import { createFileRoute } from "@tanstack/react-router";
import { Copy, FileText, Lock, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDate, useStore, type Template } from "@/lib/store";

export const Route = createFileRoute("/_app/templates")({
  head: () => ({
    meta: [
      { title: "Message templates — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Create and manage WhatsApp message templates with categories, approval status and personalisation variables.",
      },
      { property: "og:title", content: "Message templates — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Reusable WhatsApp templates for replies and campaigns.",
      },
    ],
  }),
  component: TemplatesPage,
});

const CATEGORIES = ["Marketing", "Utility", "Support", "Follow-up"];

type Draft = {
  name: string;
  category: string;
  status: Template["status"];
  body: string;
};

const emptyDraft: Draft = {
  name: "",
  category: "Marketing",
  status: "draft",
  body: "Hi {{name}}, ",
};

function TemplatesPage() {
  const { state, can, addTemplate, updateTemplate, removeTemplate } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const canUse = can("templatesUse") || can("templatesManage");
  const canManage = can("templatesManage");

  if (!canUse) {
    return (
      <div className="space-y-5">
        <PageHeader title="Templates" />
        <EmptyState
          icon={Lock}
          title="No template access"
          description="Ask the workspace owner to enable template access for your account."
        />
      </div>
    );
  }

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setOpen(true);
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setDraft({ name: t.name, category: t.category, status: t.status, body: t.body });
    setOpen(true);
  };

  const save = () => {
    if (!draft.name.trim() || !draft.body.trim()) {
      toast.error("Template name and message are required");
      return;
    }
    if (editingId) {
      updateTemplate(editingId, draft);
      toast.success("Template updated");
    } else {
      addTemplate(draft);
      toast.success("Template created");
    }
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Templates"
        description="Use {{name}} to personalise a message with the lead's name."
        actions={
          canManage ? (
            <Button onClick={startCreate}>
              <Plus className="size-4" aria-hidden="true" />
              New template
            </Button>
          ) : null
        }
      />

      {state.templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create your first template to reuse it in the inbox and in campaigns."
          action={
            canManage ? (
              <Button onClick={startCreate}>Create template</Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only members with template management can create new templates.
              </p>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.templates.map((t) => (
            <li
              key={t.id}
              className="flex flex-col rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.category}</p>
                </div>
                <StatusBadge value={t.status} />
              </div>
              <p className="mt-3 line-clamp-4 flex-1 text-sm break-words whitespace-pre-wrap text-muted-foreground">
                {t.body}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDate(t.createdAt)}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Copy ${t.name}`}
                    onClick={() => {
                      void navigator.clipboard?.writeText(t.body);
                      toast.success("Template copied");
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                  {canManage ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${t.name}`}
                        onClick={() => startEdit(t)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        aria-label={`Delete ${t.name}`}
                        onClick={() => {
                          removeTemplate(t.id);
                          toast.success("Template deleted");
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Approved templates can be inserted directly into chats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Template name</Label>
              <Input
                id="t-name"
                className="h-11"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-cat">Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft({ ...draft, category: v })}
                >
                  <SelectTrigger id="t-cat" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-status">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) =>
                    setDraft({ ...draft, status: v as Template["status"] })
                  }
                >
                  <SelectTrigger id="t-status" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-body">Message</Label>
              <Textarea
                id="t-body"
                rows={5}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Variable available: {"{{name}}"}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="h-11" onClick={save}>
              {editingId ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
