"use client";

import { useEffect, useState } from "react";
import { usePaymentLock } from "@/app/admin/payment-lock-context";

type Props = {
  children: React.ReactNode;
  /** Section title shown on the unlock screen */
  title?: string;
};

/**
 * Gates sensitive admin pages behind the Payment QR password
 * (same cookie / unlock API as Payment QR).
 */
export default function SensitiveAdminGate({
  children,
  title = "Locked section",
}: Props) {
  const { unlocked, setUnlocked } = usePaymentLock();
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  async function checkStatus() {
    try {
      const res = await fetch("/api/admin/payment-qr/unlock", { cache: "no-store" });
      if (!res.ok) {
        setUnlocked(false);
        return;
      }
      const data = await res.json();
      setUnlocked(Boolean(data.unlocked));
    } catch {
      setUnlocked(false);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setError("");

    const res = await fetch("/api/admin/payment-qr/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setUnlocking(false);

    if (!res.ok) {
      setError(data.error || "Wrong password");
      setUnlocked(false);
      return;
    }

    setPassword("");
    setUnlocked(true);
  }

  if (checking) {
    return <p className="text-brand-muted">Checking access…</p>;
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md card space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cafe-100 text-cafe-700">
            <LockGlyph />
          </div>
          <h2 className="text-xl font-bold text-brand-heading">{title}</h2>
          <p className="mt-2 text-sm text-brand-muted">
            Enter the Payment QR password to unlock this section. The same password
            is used for Offers, Inventory, Tables, Appearance, Payment QR, History,
            Insights, Recipes, and Settings.
          </p>
        </div>

        <form onSubmit={unlock} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Payment QR password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
              autoFocus
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={unlocking}>
            {unlocking ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}

function LockGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
