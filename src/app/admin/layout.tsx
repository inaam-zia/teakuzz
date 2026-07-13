"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import DeveloperCredit from "@/components/developer-credit";
import { PaymentLockProvider, usePaymentLock } from "./payment-lock-context";
import { NewOrdersProvider, useNewOrders } from "./new-orders-context";

// Admin always uses Open Sans regardless of the customer-facing theme font.
const adminFontStyle = {
  "--brand-font-family": "var(--font-open-sans), system-ui, sans-serif",
  fontFamily: "var(--font-open-sans), system-ui, sans-serif",
} as CSSProperties;

const PAYMENT_PATH = "/admin/payment";

const links = [
  { href: "/admin/orders", label: "Live orders" },
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/recipes", label: "Recipes" },
  { href: "/admin/insights", label: "Insights" },
  { href: "/admin/tables", label: "Table QR" },
  { href: "/admin/branding", label: "Appearance" },
  { href: "/admin/payment", label: "Payment QR" },
  { href: "/admin/history", label: "History" },
];

function LockIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      {open ? (
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      ) : (
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      )}
    </svg>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { unlocked, setUnlocked } = usePaymentLock();
  const { newOrderCount } = useNewOrders();
  const prevPathRef = useRef(pathname);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadAlerts() {
      try {
        const res = await fetch("/api/admin/inventory/alerts");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setLowStockCount(Number(data.count) || 0);
      } catch {
        /* ignore — table may not exist yet */
      }
    }
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname]);

  // Re-lock the payment QR section whenever the admin leaves it.
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    if (prev === PAYMENT_PATH && pathname !== PAYMENT_PATH && unlocked) {
      setUnlocked(false);
      fetch("/api/admin/payment-qr/unlock", { method: "DELETE" }).catch(() => {});
    }
  }, [pathname, unlocked, setUnlocked]);

  async function logout() {
    if (unlocked) {
      setUnlocked(false);
      await fetch("/api/admin/payment-qr/unlock", { method: "DELETE" }).catch(() => {});
    }
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
            const isPayment = link.href === PAYMENT_PATH;
            const isLiveOrders = link.href === "/admin/orders";
            const isInventory = link.href === "/admin/inventory";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  active ? "nav-active" : "nav-inactive"
                }`}
              >
                {isPayment && <LockIcon open={unlocked} />}
                {link.label}
                {isLiveOrders && newOrderCount > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {newOrderCount > 99 ? "99+" : newOrderCount}
                  </span>
                )}
                {isInventory && lowStockCount > 0 && (
                  <span
                    className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white"
                    title={`${lowStockCount} low-stock item${lowStockCount === 1 ? "" : "s"}`}
                  >
                    {lowStockCount > 99 ? "99+" : lowStockCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 [padding-bottom:calc(1.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
        <DeveloperCredit />
      </footer>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return (
      <div style={adminFontStyle} className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <footer className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
          <DeveloperCredit />
        </footer>
      </div>
    );
  }

  return (
    <PaymentLockProvider>
      <NewOrdersProvider>
        <AdminShell>{children}</AdminShell>
      </NewOrdersProvider>
    </PaymentLockProvider>
  );
}
