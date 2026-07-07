import CafeLogo from "@/components/cafe-logo";
import type { CafeBranding } from "@/lib/branding-types";

type Props = {
  branding: CafeBranding;
  logoSize?: "sm" | "md" | "lg";
  showTagline?: boolean;
  align?: "left" | "center";
  className?: string;
};

export default function CafeBrandingBlock({
  branding,
  logoSize = "sm",
  showTagline = true,
  align = "left",
  className = "",
}: Props) {
  const alignClass =
    align === "center"
      ? "flex-col items-center text-center"
      : "flex-row items-start text-left";

  return (
    <div className={`flex gap-3 ${alignClass} ${className}`}>
      {branding.logoUrl && <CafeLogo branding={branding} size={logoSize} className="shrink-0" />}
      <div className="min-w-0">
        <p
          className="font-bold leading-tight text-brand-heading"
          style={{
            fontSize:
              logoSize === "lg"
                ? "var(--brand-font-size-heading)"
                : logoSize === "md"
                  ? "1.125rem"
                  : "1rem",
          }}
        >
          {branding.appName}
        </p>
        {showTagline && branding.tagline ? (
          <p
            className="mt-0.5 leading-snug text-brand-muted"
            style={{ fontSize: "var(--brand-font-size-small)" }}
          >
            {branding.tagline}
          </p>
        ) : null}
      </div>
    </div>
  );
}
