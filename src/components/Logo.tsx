import logoAsset from "@/assets/prachar-logo.png.asset.json";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Renders the mark inside a white plate so it stays legible on navy surfaces. */
  onDark?: boolean;
};

export function Logo({ className, onDark = false }: Props) {
  const img = (
    <img
      src={logoAsset.url}
      alt="Prachar Studio"
      className={cn("h-8 w-auto object-contain", className)}
      width={366}
      height={184}
    />
  );

  if (!onDark) return img;

  return (
    <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5">
      {img}
    </span>
  );
}
