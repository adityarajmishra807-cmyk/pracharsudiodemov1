import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  neutral: "bg-surface text-muted-foreground border-border",
  navy: "bg-navy/8 text-navy border-navy/15",
  orange: "bg-primary/10 text-primary border-primary/25",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/15 text-foreground border-warning/40",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
};

const map: Record<string, keyof typeof tones> = {
  // leads
  new: "orange",
  contacted: "navy",
  qualified: "navy",
  won: "success",
  lost: "danger",
  // members
  active: "success",
  invited: "warning",
  suspended: "danger",
  // conversations
  open: "success",
  pending: "warning",
  closed: "neutral",
  // templates / campaigns / automations
  draft: "neutral",
  approved: "success",
  paused: "warning",
  scheduled: "navy",
  running: "orange",
  completed: "success",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const tone = tones[map[value] ?? "neutral"];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        tone,
        className,
      )}
    >
      {value}
    </span>
  );
}
