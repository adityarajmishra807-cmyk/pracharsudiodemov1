import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  Bot,
  Clock,
  GitBranch,
  Lock,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  UserPlus,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate, uid, useStore, type Automation, type NodeType } from "@/lib/store";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({
    meta: [
      { title: "Automation builder — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Build simple WhatsApp automation flows with triggers, delays, messages, tags, assignment and conditions.",
      },
      { property: "og:title", content: "Automation builder — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Visual, step-based automation flows for your WhatsApp CRM.",
      },
    ],
  }),
  component: AutomationsPage,
});

const NODE_META: Record<
  NodeType,
  { label: string; icon: typeof Zap; description: string }
> = {
  trigger: { label: "Trigger", icon: Zap, description: "Starts the flow" },
  delay: { label: "Delay", icon: Clock, description: "Wait before the next step" },
  message: { label: "Send message", icon: MessageSquare, description: "WhatsApp message" },
  tag: { label: "Add tag", icon: Tag, description: "Tag the lead" },
  assign: { label: "Assign", icon: UserPlus, description: "Assign to a team member" },
  condition: { label: "Condition", icon: GitBranch, description: "Branch on lead status" },
};

const ADDABLE: NodeType[] = ["delay", "message", "tag", "assign", "condition"];

function AutomationsPage() {
  const { state, can, addAutomation, updateAutomation, removeAutomation } = useStore();
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  if (!can("automations")) {
    return (
      <div className="space-y-5">
        <PageHeader title="Automations" />
        <EmptyState
          icon={Lock}
          title="No automation access"
          description="Ask the workspace owner to enable the automation builder for your account."
        />
      </div>
    );
  }

  const active = state.automations.find((a) => a.id === openId) ?? null;

  const create = () => {
    if (!name.trim()) {
      toast.error("Give the automation a name");
      return;
    }
    const created = addAutomation(name.trim());
    setName("");
    setOpenId(created.id);
    toast.success("Automation created");
  };

  const addNode = (automation: Automation, type: NodeType) => {
    updateAutomation(automation.id, {
      nodes: [
        ...automation.nodes,
        { id: uid(), type, label: NODE_META[type].label, config: {} },
      ],
    });
  };

  const removeNode = (automation: Automation, nodeId: string) => {
    updateAutomation(automation.id, {
      nodes: automation.nodes.filter((n) => n.id !== nodeId),
    });
  };

  const setConfig = (
    automation: Automation,
    nodeId: string,
    key: string,
    value: string,
  ) => {
    updateAutomation(automation.id, {
      nodes: automation.nodes.map((n) =>
        n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n,
      ),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Automations"
        description="Compose a flow step by step — every automation starts with a trigger."
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          className="h-11 sm:max-w-xs"
          placeholder="Automation name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Automation name"
        />
        <Button className="h-11" onClick={create}>
          <Plus className="size-4" aria-hidden="true" />
          Create automation
        </Button>
      </div>

      {state.automations.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No automations yet"
          description="Name your first automation above. You'll then be able to add delays, messages, tags, assignments and conditions."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {state.automations.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.nodes.length} step{a.nodes.length === 1 ? "" : "s"} · created{" "}
                    {formatDate(a.createdAt)}
                  </p>
                </div>
                <StatusBadge value={a.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setOpenId(a.id)}>
                  Open builder
                </Button>
                <Select
                  value={a.status}
                  onValueChange={(v) =>
                    updateAutomation(a.id, { status: v as Automation["status"] })
                  }
                >
                  <SelectTrigger className="h-9 w-32" aria-label="Automation status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    removeAutomation(a.id);
                    toast.success("Automation deleted");
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={active !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle>{active.name}</SheetTitle>
                <SheetDescription>
                  Steps run top to bottom. Configure each one inline.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 px-4 pb-6">
                {active.nodes.map((node, index) => {
                  const meta = NODE_META[node.type];
                  const Icon = meta.icon;
                  return (
                    <div key={node.id}>
                      {index > 0 ? (
                        <ArrowDown
                          className="mx-auto mb-2 size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy text-white">
                              <Icon className="size-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-navy">
                                {meta.label}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {meta.description}
                              </p>
                            </div>
                          </div>
                          {node.type !== "trigger" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              aria-label={`Remove ${meta.label}`}
                              onClick={() => removeNode(active, node.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>

                        <div className="mt-3 space-y-2">
                          {node.type === "trigger" ? (
                            <div className="space-y-1.5">
                              <Label htmlFor={`n-${node.id}`}>When</Label>
                              <Select
                                value={node.config['event'] ?? "lead_created"}
                                onValueChange={(v) =>
                                  setConfig(active, node.id, "event", v)
                                }
                              >
                                <SelectTrigger id={`n-${node.id}`} className="h-11 w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="lead_created">
                                    A lead is created
                                  </SelectItem>
                                  <SelectItem value="message_received">
                                    A message is received
                                  </SelectItem>
                                  <SelectItem value="status_changed">
                                    Lead status changes
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
                          {node.type === "delay" ? (
                            <div className="space-y-1.5">
                              <Label htmlFor={`n-${node.id}`}>Wait (minutes)</Label>
                              <Input
                                id={`n-${node.id}`}
                                className="h-11"
                                inputMode="numeric"
                                value={node.config['minutes'] ?? ""}
                                onChange={(e) =>
                                  setConfig(active, node.id, "minutes", e.target.value)
                                }
                              />
                            </div>
                          ) : null}
                          {node.type === "message" ? (
                            <div className="space-y-1.5">
                              <Label htmlFor={`n-${node.id}`}>Template</Label>
                              <Select
                                value={node.config['templateId'] ?? "none"}
                                onValueChange={(v) =>
                                  setConfig(active, node.id, "templateId", v)
                                }
                              >
                                <SelectTrigger id={`n-${node.id}`} className="h-11 w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Choose a template</SelectItem>
                                  {state.templates.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {state.templates.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No templates created yet.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {node.type === "tag" ? (
                            <div className="space-y-1.5">
                              <Label htmlFor={`n-${node.id}`}>Tag to add</Label>
                              <Input
                                id={`n-${node.id}`}
                                className="h-11"
                                value={node.config['tag'] ?? ""}
                                onChange={(e) =>
                                  setConfig(active, node.id, "tag", e.target.value)
                                }
                              />
                            </div>
                          ) : null}
                          {node.type === "assign" ? (
                            <div className="space-y-1.5">
                              <Label htmlFor={`n-${node.id}`}>Assign to</Label>
                              <Select
                                value={node.config['memberId'] ?? "owner"}
                                onValueChange={(v) =>
                                  setConfig(active, node.id, "memberId", v)
                                }
                              >
                                <SelectTrigger id={`n-${node.id}`} className="h-11 w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="owner">Owner</SelectItem>
                                  {state.members.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {m.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
                          {node.type === "condition" ? (
                            <div className="space-y-1.5">
                              <Label htmlFor={`n-${node.id}`}>
                                Continue only if status is
                              </Label>
                              <Select
                                value={node.config['status'] ?? "new"}
                                onValueChange={(v) =>
                                  setConfig(active, node.id, "status", v)
                                }
                              >
                                <SelectTrigger id={`n-${node.id}`} className="h-11 w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["new", "contacted", "qualified", "won", "lost"].map(
                                    (s) => (
                                      <SelectItem key={s} value={s} className="capitalize">
                                        {s}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-lg border border-dashed border-border p-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Add a step
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ADDABLE.map((type) => {
                      const Icon = NODE_META[type].icon;
                      return (
                        <Button
                          key={type}
                          size="sm"
                          variant="outline"
                          onClick={() => addNode(active, type)}
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                          {NODE_META[type].label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
