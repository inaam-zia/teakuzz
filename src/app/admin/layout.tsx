"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties } from "react";

// Admin always uses Open Sans regardless of the customer-facing theme font.
const adminFontStyle = {
  "--brand-font-family": "var(--font-open-sans), system-ui, sans-serif",
  fontFamily: "var(--font-open-sans), system-ui, sans-serif",
} as CSSProperties;

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Live orders" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/tables", label: "Table QR" },
  { href: "/admin/branding", label: "Appearance" },
  { href: "/admin/payment", label: "Payment QR" },
  { href: "/admin/history", label: "History" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") {
    return <div style={adminFontStyle}>{children}</div>;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen" style={adminFontStyle}>
      <header className="sticky top-0 z-40 border-b border-brand bg-brand-surface/95 backdrop-blur-md [padding-top:env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <h1 className="text-base font-bold text-brand-heading sm:text-lg">Cafe Admin</h1>
          <button
            onClick={logout}
            className="shrink-0 text-sm text-brand-muted hover:text-brand-heading"
          >
            Log out
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  active ? "nav-active" : "nav-inactive"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 [padding-bottom:calc(1.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
