import { Outlet, createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { ready, state } = useStore();
  const router = useRouter();
  const signedIn = state.session !== null;

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
