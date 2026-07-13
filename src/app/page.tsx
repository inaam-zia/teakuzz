import Link from "next/link";
import CafeBrandingBlock from "@/components/cafe-branding-block";
import DeveloperCredit from "@/components/developer-credit";
import { getBranding } from "@/lib/branding";

export default async function HomePage() {
  const branding = await getBranding();

  return (
    <main className="mx-auto flex min-h-screen min-h-dvh max-w-lg flex-col px-6 text-center">
      <div className="flex flex-1 flex-col items-center justify-center py-10">
        <div className="card w-full space-y-6">
          <CafeBrandingBlock branding={branding} logoSize="lg" showTagline align="center" />

          <div className="rounded-xl bg-brand-top px-4 py-3 text-sm text-brand-muted">
            No app needed — works in your phone browser.
          </div>

          <Link href="/admin/login" className="btn-secondary w-full">
            Admin login
          </Link>
        </div>
      </div>
      <DeveloperCredit className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2" />
    </main>
  );
}
