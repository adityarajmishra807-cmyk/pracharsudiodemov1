import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { ownerLoginFn } from "@/lib/server-auth";
import { activateLicenseFn } from "@/server/license";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Prachar Studio WhatsApp CRM" },
      {
        name: "description",
        content:
          "Secure owner and customer access to the Prachar Studio WhatsApp CRM and admin panel.",
      },
      { property: "og:title", content: "Sign in — Prachar Studio WhatsApp CRM" },
      {
        property: "og:description",
        content:
          "Secure owner and licensed customer access to the Prachar Studio WhatsApp CRM and admin panel.",
      },
    ],
  }),
  component: EntryScreen,
});

function EntryScreen() {
  const { ready, state, updateSettings } = useStore();
  const router = useRouter();
  const [ownerPassword, setOwnerPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [licenseMessage, setLicenseMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [ownerMessage, setOwnerMessage] = useState<string | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [licenseLoading, setLicenseLoading] = useState(false);

  const canEnter = ready && termsAccepted;

  const enterAsOwner = async () => {
    if (!canEnter || ownerLoading) return;
    setOwnerLoading(true);
    setOwnerMessage(null);

    try {
      const result = await ownerLoginFn({
        data: {
          email: state.settings.ownerEmail.trim(),
          password: ownerPassword,
        },
      });

      if (!result.ok) {
        setOwnerMessage(result.message);
        return;
      }

      void router.navigate({ to: "/dashboard" });
    } catch (error) {
      setOwnerMessage(error instanceof Error ? error.message : "Owner login failed.");
    } finally {
      setOwnerLoading(false);
    }
  };

  const activate = async () => {
    if (!canEnter || licenseLoading) return;
    if (!licenseKey.trim()) {
      setLicenseMessage({ type: "error", text: "Enter a license key first." });
      return;
    }

    setLicenseLoading(true);
    setLicenseMessage(null);

    try {
      const result = await activateLicenseFn({
        data: { key: licenseKey, customerName, customerEmail },
      });

      setLicenseMessage({
        type: "success",
        text:
          result.license.type === "trial"
            ? "7-day trial activated successfully."
            : "Permanent license activated successfully.",
      });
      setLicenseKey("");
      void router.navigate({ to: "/dashboard" });
    } catch (error) {
      setLicenseMessage({
        type: "error",
        text: error instanceof Error ? error.message : "License activation failed.",
      });
    } finally {
      setLicenseLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-2">
      <section className="flex flex-1 flex-col justify-between bg-navy px-6 py-8 lg:px-12 lg:py-12">
        <Logo onDark />
        <div className="mt-10 lg:mt-0">
          <h1 className="max-w-md text-2xl leading-tight font-extrabold text-white lg:text-4xl">
            WhatsApp CRM & admin workspace
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 lg:text-base">
            Leads, conversations, templates, campaigns, automations and team permissions in one place.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/75">
            {[
              "Server-side owner authentication",
              "Central license validation",
              "Owner-controlled workspace permissions",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-10 text-xs text-white/45 lg:mt-0">
          Secure application access · licenses are validated on the server
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-white px-5 py-10 lg:px-12">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-navy">Enter the workspace</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Use owner credentials or a customer license key.
          </p>

          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Owner access
            </div>

            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="owner-email">Owner email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="owner@example.com"
                  value={state.settings.ownerEmail}
                  onChange={(e) => updateSettings({ ownerEmail: e.target.value })}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner-password">Owner password</Label>
                <Input
                  id="owner-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter owner password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  className="h-11"
                />
              </div>

              {ownerMessage ? (
                <p className="text-xs font-medium text-destructive" role="alert">
                  {ownerMessage}
                </p>
              ) : null}
            </div>

            <Button
              onClick={() => void enterAsOwner()}
              className="mt-4 h-11 w-full"
              disabled={!canEnter || ownerLoading}
            >
              {ownerLoading ? "Signing in…" : "Sign in as owner"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Customer license
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Enter the license key provided by the Prachar Studio owner. A trial key lasts 7 days from activation.
            </p>

            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="license-key">License key</Label>
                <Input
                  id="license-key"
                  className="h-11 font-mono uppercase"
                  placeholder="PRA-XXXXX-XXXXX-XXXXX-XXXXX"
                  value={licenseKey}
                  onChange={(e) => {
                    setLicenseKey(e.target.value.toUpperCase());
                    setLicenseMessage(null);
                  }}
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="customer-name">Customer name</Label>
                  <Input
                    id="customer-name"
                    className="h-11"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customer-email">Email</Label>
                  <Input
                    id="customer-email"
                    className="h-11"
                    type="email"
                    inputMode="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={() => void activate()}
              className="mt-3 h-11 w-full"
              disabled={!canEnter || licenseLoading}
            >
              {licenseLoading ? "Activating…" : "Activate license"}
              <ShieldCheck className="size-4" aria-hidden="true" />
            </Button>

            {licenseMessage ? (
              <p
                className={
                  licenseMessage.type === "success"
                    ? "mt-2 text-xs font-medium text-primary"
                    : "mt-2 text-xs font-medium text-destructive"
                }
                role="status"
              >
                {licenseMessage.text}
              </p>
            ) : null}
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <Users className="size-4 text-primary" aria-hidden="true" />
              Team access
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Team members are controlled by the workspace owner. Customer access is granted through a valid license key.
            </p>
          </div>

          <div className="mt-5 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="accept-terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                aria-describedby="terms-description"
                className="mt-0.5"
              />
              <div className="min-w-0">
                <Label
                  htmlFor="accept-terms"
                  className="cursor-pointer text-sm font-medium leading-5 text-foreground"
                >
                  I have read and agree to the{" "}
                  <Link
                    to="/terms"
                    className="font-semibold text-navy underline underline-offset-2 hover:text-primary"
                  >
                    Terms & Conditions
                  </Link>
                  .
                </Label>
                <p id="terms-description" className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  This includes WhatsApp account and number risks, bulk messaging restrictions, acceptable-use rules, and your responsibility for messages sent through Prachar Studio.
                </p>
              </div>
            </div>
          </div>

          {!termsAccepted ? (
            <p className="mt-3 text-center text-xs font-medium text-primary">
              Accept the Terms & Conditions to continue.
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <Link to="/terms" className="font-medium text-navy transition-colors hover:text-primary">
              Terms & Conditions
            </Link>
            <span aria-hidden="true">•</span>
            <span>Secure server-validated access.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
