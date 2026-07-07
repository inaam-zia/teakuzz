import type { CafeBranding } from "@/lib/branding-types";

type Props = {
  branding: CafeBranding;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-8 max-w-[120px]",
  md: "h-12 max-w-[180px]",
  lg: "h-16 max-w-[240px]",
};

export default function CafeLogo({ branding, size = "md", className = "" }: Props) {
  if (branding.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={branding.logoUrl}
        alt={branding.appName}
        className={`object-contain ${sizes[size]} ${className}`}
      />
    );
  }

  return (
    <span
      className={`font-bold text-[var(--brand-heading)] ${className}`}
      style={{ fontSize: size === "lg" ? "var(--brand-font-size-heading)" : "1.125rem" }}
    >
      {branding.appName}
    </span>
  );
}
