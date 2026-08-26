import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Prachar Studio WhatsApp CRM" },
      {
        name: "description",
        content:
          "Enter the Prachar Studio workspace to manage leads, WhatsApp conversations, templates, campaigns and team permissions.",
      },
      { property: "og:title", content: "Sign in — Prachar Studio WhatsApp CRM" },
      {
        property: "og:description",
        content:
          "Owner and member access to the Prachar Studio WhatsApp CRM and admin panel.",
      },
    ],
  }),
  component: EntryScreen,
});

function EntryScreen() {
  const { ready, state, signIn, updateSettings } = useStore();
  const router = useRouter();
  const [ownerName, setOwnerName] = useState("");

  const members = state.members.filter((m) => m.status !== "suspended");

  const enterAsOwner = () => {
    const name = ownerName.trim() || state.settings.ownerName;
    if (name && name !== state.settings.ownerName) updateSettings({ ownerName: name });
    signIn({ kind: "owner" });
    void router.navigate({ to: "/dashboard" });
  };

  const enterAsMember = (memberId: string) => {
    signIn({ kind: "member", memberId });
    void router.navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section className="flex flex-col justify-between bg-navy px-6 py-8 lg:px-12 lg:py-12">
        <Logo onDark />
        <div className="mt-10 lg:mt-0">
          <h1 className="max-w-md text-2xl leading-tight font-extrabold text-white lg:text-4xl">
            WhatsApp CRM & admin workspace
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 lg:text-base">
            Leads, conversations, templates, campaigns, automations and team permissions
            in one place — built for the Prachar Studio team.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/75">
            {[
              "Owner-controlled team permissions",
              "WhatsApp-style inbox with template insertion",
              "Campaign and automation builders",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-10 text-xs text-white/45 lg:mt-0">
          Frontend demo · data stays in this browser
        </p>
      </section>

      {/* Entry panel */}
      <section className="flex items-center justify-center bg-white px-5 py-10 lg:px-12">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-navy">Enter the workspace</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose how you want to review the demo.
          </p>

          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Owner access
            </div>
            <div className="mt-3 space-y-2">
              <Label htmlFor="owner-name">Your name</Label>
              <Input
                id="owner-name"
                autoComplete="name"
                placeholder={state.settings.ownerName || "e.g. Workspace owner"}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Used on your profile inside the workspace.
              </p>
            </div>
            <Button onClick={enterAsOwner} className="mt-4 h-11 w-full" disabled={!ready}>
              Continue as owner
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <Users className="size-4 text-primary" aria-hidden="true" />
              Member access
            </div>
            {members.length === 0 ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                No team members exist yet. Sign in as owner and add members in Team
                Management to test permission-based access.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {members.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => enterAsMember(member.id)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {member.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {member.jobTitle || member.email}
                        </span>
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
