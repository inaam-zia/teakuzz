import Link from "next/link";
import CafeBrandingBlock from "@/components/cafe-branding-block";
import { getBranding } from "@/lib/branding";

export default async function HomePage() {
  const branding = await getBranding();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="card w-full space-y-6">
        <CafeBrandingBlock branding={branding} logoSize="lg" showTagline align="center" />

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
