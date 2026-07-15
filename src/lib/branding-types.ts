export type CafeTheme = {
  colorPrimary: string;
  colorPrimaryHover: string;
  colorBackground: string;
  colorBackgroundTop: string;
  colorSurface: string;
  colorBorder: string;
  colorHeaderBg: string;
  colorFooterBg: string;
  colorHeading: string;
  colorBody: string;
  colorMuted: string;
  colorSubtle: string;
  colorButtonText: string;
  colorAccent: string;
  fontFamily: string;
  fontSizeBase: string;
  fontSizeHeading: string;
  fontSizeSmall: string;
};

export type CafeBranding = {
  appName: string;
  logoUrl: string | null;
  tagline: string;
  theme: CafeTheme;
  /** When true, show GSTIN on bills and apply GST % when set */
  gstEnabled: boolean;
  /** GST Identification Number */
  gstin: string | null;
  /** GST percentage added on bill (e.g. 5 for 5%) */
  gstPercent: number;
};

export const DEFAULT_THEME: CafeTheme = {
  colorPrimary: "#8a5639",
  colorPrimaryHover: "#714733",
  colorBackground: "#faf6f1",
  colorBackgroundTop: "#f3ebe0",
  colorSurface: "#ffffff",
  colorBorder: "#e6d4bc",
  colorHeaderBg: "rgba(255,255,255,0.85)",
  colorFooterBg: "rgba(255,255,255,0.95)",
  colorHeading: "#5c3b2c",
  colorBody: "#5c3b2c",
  colorMuted: "#8a5639",
  colorSubtle: "#b8834f",
  colorButtonText: "#ffffff",
  colorAccent: "#c49a6c",
  fontFamily: "open-sans",
  fontSizeBase: "16px",
  fontSizeHeading: "24px",
  fontSizeSmall: "14px",
};

export const FONT_OPTIONS = [
  {
    id: "open-sans",
    label: "Open Sans",
    // Literal "Open Sans" keeps a sans fallback if the Next font var is missing
    // (otherwise an invalid var() makes the whole font-family fall back to Times).
    css: 'var(--font-open-sans), "Open Sans", system-ui, sans-serif',
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    css: 'var(--font-dm-sans), "DM Sans", system-ui, sans-serif',
  },
  {
    id: "inter",
    label: "Inter",
    css: 'var(--font-inter), Inter, system-ui, sans-serif',
  },
  {
    id: "poppins",
    label: "Poppins",
    css: 'var(--font-poppins), Poppins, system-ui, sans-serif',
  },
  {
    id: "lora",
    label: "Lora",
    css: 'var(--font-lora), Lora, Georgia, serif',
  },
  { id: "system", label: "System default", css: "system-ui, sans-serif" },
] as const;

export function resolveFontFamilyId(raw?: string | null): string {
  const id = String(raw || "").trim().toLowerCase();
  if (FONT_OPTIONS.some((f) => f.id === id)) return id;
  // Common aliases / mistakes from saved theme data
  if (id.includes("open")) return "open-sans";
  if (id.includes("dm")) return "dm-sans";
  if (id.includes("inter")) return "inter";
  if (id.includes("poppin")) return "poppins";
  if (id.includes("lora")) return "lora";
  if (id.includes("system")) return "system";
  return "open-sans";
}

export function getDefaultBranding(): CafeBranding {
  const envName = process.env.NEXT_PUBLIC_CAFE_NAME;
  return {
    appName: envName || "Teakkuzz Cafe",
    logoUrl: null,
    tagline: "Scan the QR code on your table to browse the menu and place an order.",
    theme: { ...DEFAULT_THEME },
    gstEnabled: false,
    gstin: null,
    gstPercent: 0,
  };
}

export function mergeTheme(partial?: Partial<CafeTheme> | null): CafeTheme {
  const merged = { ...DEFAULT_THEME, ...(partial || {}) };
  merged.fontFamily = resolveFontFamilyId(merged.fontFamily);
  return merged;
}

export function themeToCssVars(theme: CafeTheme): Record<string, string> {
  const fontId = resolveFontFamilyId(theme.fontFamily);
  const font = FONT_OPTIONS.find((f) => f.id === fontId) || FONT_OPTIONS[0];

  return {
    "--brand-primary": theme.colorPrimary,
    "--brand-primary-hover": theme.colorPrimaryHover,
    "--brand-bg": theme.colorBackground,
    "--brand-bg-top": theme.colorBackgroundTop,
    "--brand-surface": theme.colorSurface,
    "--brand-border": theme.colorBorder,
    "--brand-header-bg": theme.colorHeaderBg,
    "--brand-footer-bg": theme.colorFooterBg,
    "--brand-heading": theme.colorHeading,
    "--brand-text": theme.colorBody,
    "--brand-muted": theme.colorMuted,
    "--brand-subtle": theme.colorSubtle,
    "--brand-button-text": theme.colorButtonText,
    "--brand-accent": theme.colorAccent,
    "--brand-font-family": font.css,
    "--brand-font-size-base": theme.fontSizeBase,
    "--brand-font-size-heading": theme.fontSizeHeading,
    "--brand-font-size-small": theme.fontSizeSmall,
  };
}

export function brandingToStyleString(branding: CafeBranding): string {
  const vars = themeToCssVars(branding.theme);
  const lines = Object.entries(vars).map(([k, v]) => `${k}: ${v};`);
  return `:root { ${lines.join(" ")} }`;
}
