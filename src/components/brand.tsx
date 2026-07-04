import { cn } from "@/lib/utils";

/**
 * HUBz wordmark — the product logo. This app is "HUBz Loyalty", part of the
 * HUBz ecosystem (alongside HUBz Studio), so the HUBz wordmark carries a small
 * "Loyalty" tag. Use variant="dark" on dark surfaces (renders the white logo).
 * The logo is a raster asset from the brand pack in /public/brand.
 */
export function HubzWordmark({
  variant = "light",
  showTag = true,
  className,
  imgClassName = "h-5 w-auto",
  tagClassName,
}: {
  variant?: "light" | "dark";
  showTag?: boolean;
  className?: string;
  imgClassName?: string;
  tagClassName?: string;
}) {
  const src =
    variant === "dark"
      ? "/brand/hubz-wordmark-white.png"
      : "/brand/hubz-wordmark-black.png";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="HUBz" className={imgClassName} />
      {showTag ? (
        <span
          className={cn(
            "font-mono text-[9px] font-semibold uppercase tracking-[0.22em]",
            variant === "dark" ? "text-white/55" : "text-ink-faint",
            tagClassName
          )}
        >
          Loyalty
        </span>
      ) : null}
    </span>
  );
}
