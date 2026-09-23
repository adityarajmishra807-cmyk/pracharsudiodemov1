import { Outlet, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { getAuthFn } from "@/server/auth";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const auth = await getAuthFn();
    if (!auth) {
      throw redirect({ to: "/", search: { redirect: location.href } });
    }
    return { auth };
  },
  component: AppLayout,
});

function AppLayout() {
  const { ready, state, signIn } = useStore();
  const { auth } = Route.useRouteContext();
  const router = useRouter();
  const signedIn = state.session !== null;

  useEffect(() => {
    if (auth.role === "owner") {
      signIn({ kind: "owner" });
    } else {
      signIn({
        kind: "license",
        licenseId: auth.licenseId,
        licenseType: auth.licenseType,
        expiresAt: auth.expiresAt,
      });
    }
  }, [auth, signIn]);

  useEffect(() => {
    if (ready && !signedIn) void router.navigate({ to: "/" });
  }, [ready, signedIn, router]);

  if (!ready || !signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-sm text-muted-foreground">Loading workspace…</p>
      </div>
    );
  }

  return (
    <AppShell>
      {/* Required: nested routes render here. */}
      <Outlet />
    </AppShell>
  );
}
