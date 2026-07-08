"use client";

import { useEffect, useState } from "react";
import type { CafeBranding, CafeTheme } from "@/lib/branding-types";
import { DEFAULT_THEME, FONT_OPTIONS } from "@/lib/branding-types";
import CafeLogo from "@/components/cafe-logo";

type ColorField = {
  key: keyof CafeTheme;
  label: string;
  group: string;
};

const COLOR_FIELDS: ColorField[] = [
  { key: "colorPrimary", label: "Primary (buttons)", group: "Main colors" },
  { key: "colorPrimaryHover", label: "Primary hover", group: "Main colors" },
  { key: "colorAccent", label: "Accent", group: "Main colors" },
  { key: "colorBackground", label: "Page background", group: "Backgrounds" },
  { key: "colorBackgroundTop", label: "Gradient top", group: "Backgrounds" },
  { key: "colorSurface", label: "Cards / surfaces", group: "Backgrounds" },
  { key: "colorHeaderBg", label: "Header background", group: "Header & footer" },
  { key: "colorFooterBg", label: "Footer / cart bar", group: "Header & footer" },
  { key: "colorBorder", label: "Borders", group: "Text & borders" },
  { key: "colorHeading", label: "Headings", group: "Text & borders" },
  { key: "colorBody", label: "Body text", group: "Text & borders" },
  { key: "colorMuted", label: "Muted text", group: "Text & borders" },
  { key: "colorSubtle", label: "Subtle / labels", group: "Text & borders" },
  { key: "colorButtonText", label: "Button text", group: "Text & borders" },
];

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isHex = value.startsWith("#");

  return (
    <div className="flex items-center gap-3">
      <label className="w-28 shrink-0 text-sm text-brand-muted sm:w-40">{label}</label>
      {isHex && (
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-brand bg-white sm:w-12"
        />
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field w-0 min-w-0 flex-1 py-2 font-mono text-xs"
      />
    </div>
  );
}

export default function BrandingPage() {
  const [branding, setBranding] = useState<CafeBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/branding");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load branding");
      return;
    }
    setBranding(data);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function updateTheme(key: keyof CafeTheme, value: string) {
    if (!branding) return;
    setBranding({ ...branding, theme: { ...branding.theme, [key]: value } });
  }

  async function save() {
    if (!branding) return;
    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appName: branding.appName,
        tagline: branding.tagline,
        logoUrl: branding.logoUrl,
        theme: branding.theme,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }

    setBranding(data);
    setSuccess("Saved! Refresh the customer page to see changes.");
    window.location.reload();
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/branding/logo", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error || "Could not upload logo");
      return;
    }

    setBranding((b) => (b ? { ...b, logoUrl: data.url } : b));
  }

  async function removeLogo() {
    const res = await fetch("/api/branding/logo", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not remove logo");
      return;
    }
    setBranding((b) => (b ? { ...b, logoUrl: null } : b));
  }

  function resetTheme() {
    if (!branding) return;
    setBranding({ ...branding, theme: { ...DEFAULT_THEME } });
  }

  if (loading) {
    return <p className="text-brand-muted">Loading…</p>;
  }

  if (!branding) {
    return <p className="text-red-600">{error || "Could not load settings"}</p>;
  }

  const groups = Array.from(new Set(COLOR_FIELDS.map((f) => f.group)));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-heading">App appearance</h2>
        <p className="text-brand-muted">
          Customize name, logo, colors, and fonts for the customer ordering app.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="card space-y-4">
            <h3 className="font-bold text-brand-heading">App identity</h3>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">App name</label>
              <input
                value={branding.appName}
                onChange={(e) => setBranding({ ...branding, appName: e.target.value })}
                className="input-field"
                placeholder="Teakkuzz Cafe"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">
                Tagline (home page)
              </label>
              <textarea
                value={branding.tagline}
                onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                className="input-field min-h-[80px]"
                rows={3}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">Logo</label>
              <div className="flex flex-wrap items-center gap-4">
                <CafeLogo branding={branding} size="lg" />
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadLogo(f);
                    }}
                    className="text-sm"
                  />
                  {branding.logoUrl && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="card space-y-4">
            <h3 className="font-bold text-brand-heading">Typography</h3>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">Font family</label>
              <select
                value={branding.theme.fontFamily}
                onChange={(e) => updateTheme("fontFamily", e.target.value)}
                className="input-field"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">Base font size</label>
              <input
                value={branding.theme.fontSizeBase}
                onChange={(e) => updateTheme("fontSizeBase", e.target.value)}
                className="input-field"
                placeholder="16px"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">Heading font size</label>
              <input
                value={branding.theme.fontSizeHeading}
                onChange={(e) => updateTheme("fontSizeHeading", e.target.value)}
                className="input-field"
                placeholder="24px"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">Small text size</label>
              <input
                value={branding.theme.fontSizeSmall}
                onChange={(e) => updateTheme("fontSizeSmall", e.target.value)}
                className="input-field"
                placeholder="14px"
              />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand-heading">Colors</h3>
              <button type="button" onClick={resetTheme} className="btn-secondary py-2 text-xs">
                Reset colors
              </button>
            </div>
            {groups.map((group) => (
              <div key={group} className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-subtle">
                  {group}
                </p>
                {COLOR_FIELDS.filter((f) => f.group === group).map((field) => (
                  <ColorInput
                    key={field.key}
                    label={field.label}
                    value={String(branding.theme[field.key])}
                    onChange={(v) => updateTheme(field.key, v)}
                  />
                ))}
              </div>
            ))}
          </section>

          <section className="card">
            <h3 className="mb-4 font-bold text-brand-heading">Preview</h3>
            <div
              className="order-bg rounded-2xl border p-4"
              style={{
                background: `linear-gradient(to bottom, ${branding.theme.colorBackgroundTop}, ${branding.theme.colorBackground})`,
              }}
            >
              <div
                className="order-header rounded-xl px-4 py-3"
                style={{ backgroundColor: branding.theme.colorHeaderBg }}
              >
                <CafeLogo branding={branding} size="sm" />
                <p
                  className="mt-1 text-xs uppercase tracking-widest"
                  style={{ color: branding.theme.colorSubtle }}
                >
                  Table 3
                </p>
              </div>
              <div
                className="mt-3 rounded-xl border p-3"
                style={{
                  backgroundColor: branding.theme.colorSurface,
                  borderColor: branding.theme.colorBorder,
                }}
              >
                <p style={{ color: branding.theme.colorHeading, fontWeight: 600 }}>Maggi</p>
                <p style={{ color: branding.theme.colorMuted, fontSize: branding.theme.fontSizeSmall }}>
                  ₹79
                </p>
              </div>
              <button
                type="button"
                className="mt-3 w-full rounded-xl py-2 text-sm font-semibold"
                style={{
                  backgroundColor: branding.theme.colorPrimary,
                  color: branding.theme.colorButtonText,
                }}
              >
                Place order
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save appearance"}
        </button>
      </div>
    </div>
  );
}
