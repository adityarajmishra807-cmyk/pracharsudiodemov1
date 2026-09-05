import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Renders the mark inside a white plate so it stays legible on navy surfaces. */
  onDark?: boolean;
};

function LogoMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 items-center justify-center rounded-[7px] bg-navy text-[11px] font-extrabold tracking-tight text-white shadow-sm ring-1 ring-black/10"
    >
      P
    </span>
  );
}

export function Logo({ className, onDark = false }: Props) {
  const logo = (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-[18px] font-extrabold tracking-[-0.03em] text-navy",
        className,
      )}
    >
      <LogoMark />
      <span>Prachar</span>
    </span>
  );

  if (!onDark) return logo;

  return (
    <span className="inline-flex items-center rounded-md bg-white px-3 py-2">
      {logo}
    </span>
  );
}
