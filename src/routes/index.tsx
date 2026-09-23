import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Prachar Studio" }] }),
  component: EntryScreen,
});

function EntryScreen() {
  return <Navigate to="/dashboard" />;
}
