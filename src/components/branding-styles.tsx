import { brandingToStyleString } from "@/lib/branding-types";
import type { CafeBranding } from "@/lib/branding-types";

export default function BrandingStyles({ branding }: { branding: CafeBranding }) {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: brandingToStyleString(branding),
      }}
    />
  );
}
