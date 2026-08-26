import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Workspace settings for Prachar Studio: business profile, WhatsApp number, timezone and notification preferences.",
      },
      { property: "og:title", content: "Settings — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Manage your Prachar Studio workspace profile and notifications.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, can, isOwner, updateSettings, resetDemo } = useStore();
  const router = useRouter();
  const s = state.settings;

  if (!can("settings")) {
    return (
      <div className="space-y-5">
        <PageHeader title="Settings" />
        <EmptyState
          icon={Lock}
          title="No settings access"
          description="Ask the workspace owner to enable settings access for your account."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Changes save instantly to this browser."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-workspace">Workspace name</Label>
              <Input
                id="s-workspace"
                className="h-11"
                value={s.workspaceName}
                onChange={(e) => updateSettings({ workspaceName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-owner">Owner name</Label>
              <Input
                id="s-owner"
                className="h-11"
                value={s.ownerName}
                onChange={(e) => updateSettings({ ownerName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email">Owner email</Label>
              <Input
                id="s-email"
                type="email"
                inputMode="email"
                className="h-11"
                value={s.ownerEmail}
                onChange={(e) => updateSettings({ ownerEmail: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">WhatsApp & notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-wa">WhatsApp business number</Label>
              <Input
                id="s-wa"
                inputMode="tel"
                className="h-11"
                placeholder="+91 00000 00000"
                value={s.whatsappNumber}
                onChange={(e) => updateSettings({ whatsappNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-tz">Timezone</Label>
              <Input
                id="s-tz"
                className="h-11"
                value={s.timezone}
                onChange={(e) => updateSettings({ timezone: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <Label htmlFor="s-n1" className="text-sm font-normal">
                Notify me about new leads
              </Label>
              <Switch
                id="s-n1"
                checked={s.notifyNewLead}
                onCheckedChange={(v) => updateSettings({ notifyNewLead: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="s-n2" className="text-sm font-normal">
                Notify me about new messages
              </Label>
              <Switch
                id="s-n2"
                checked={s.notifyNewMessage}
                onCheckedChange={(v) => updateSettings({ notifyNewMessage: v })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {isOwner ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base">Reset workspace</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm text-muted-foreground">
              Removes every member, lead, conversation, template, campaign and automation
              you created in this browser and returns to the empty state.
            </p>
            <Button
              variant="destructive"
              className="h-11"
              onClick={() => {
                resetDemo();
                toast.success("Workspace reset");
                void router.navigate({ to: "/" });
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset everything
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
