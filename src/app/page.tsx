import Link from "next/link";
import CafeLogo from "@/components/cafe-logo";
import { getBranding } from "@/lib/branding";

export default async function HomePage() {
  const branding = await getBranding();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="card w-full space-y-6">
        <div className="flex flex-col items-center gap-3">
          <CafeLogo branding={branding} size="lg" />
          {!branding.logoUrl && (
            <p className="text-sm font-medium uppercase tracking-wider text-brand-subtle">
              Welcome to
            </p>
          )}
          {branding.logoUrl ? null : (
            <h1 className="text-3xl font-bold text-brand-heading">{branding.appName}</h1>
          )}
        </div>

        <p className="text-brand-muted">{branding.tagline}</p>

        <div className="rounded-xl bg-brand-top px-4 py-3 text-sm text-brand-muted">
          No app needed — works in your phone browser.
        </div>

        <Link href="/admin/login" className="btn-secondary w-full">
          Admin login
        </Link>
      </div>
    </main>
  );
}
