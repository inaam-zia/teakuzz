"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Status = {
  adminPasswordCustomized: boolean;
  paymentQrPasswordCustomized: boolean;
  envAdminFallback: boolean;
  envPaymentQrFallback: boolean;
};

const emptyAdminForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const emptyPaymentForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function SettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  async function loadStatus() {
    const res = await fetch("/api/admin/passwords");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load settings");
      return;
    }
    setStatus(data);
  }

  useEffect(() => {
    loadStatus().finally(() => setLoading(false));
  }, []);

  async function changePassword(
    kind: "admin" | "payment_qr",
    form: typeof emptyAdminForm
  ) {
    setError("");
    setSuccess("");

    const res = await fetch("/api/admin/passwords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not update password");
      return { ok: false as const, logout: false };
    }
    setSuccess(data.message || "Password updated.");
    if (!data.logout) {
      await loadStatus();
    }
    return { ok: true as const, logout: Boolean(data.logout) };
  }

  async function onSaveAdmin(e: React.FormEvent) {
    e.preventDefault();
    setSavingAdmin(true);
    try {
      const result = await changePassword("admin", adminForm);
      if (result.ok) {
        setAdminForm(emptyAdminForm);
        if (result.logout) {
          router.replace("/admin/login");
          router.refresh();
          return;
        }
      }
    } finally {
      setSavingAdmin(false);
    }
  }

  async function onSavePayment(e: React.FormEvent) {
    e.preventDefault();
    setSavingPayment(true);
    try {
      const result = await changePassword("payment_qr", paymentForm);
      if (result.ok) setPaymentForm(emptyPaymentForm);
    } finally {
      setSavingPayment(false);
    }
  }

  if (loading) {
    return <p className="text-brand-muted">Loading settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-heading">Settings</h2>
        <p className="text-brand-muted">
          Change your admin login password and the Payment QR unlock password.
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

      <form onSubmit={onSaveAdmin} className="card space-y-4">
        <div>
          <h3 className="font-bold text-brand-heading">Admin login password</h3>
          <p className="mt-1 text-sm text-brand-muted">
            Used to sign in to the admin panel.
            {status?.adminPasswordCustomized
              ? " Currently using a password saved from Settings."
              : status?.envAdminFallback
                ? " Currently using the password from server environment (ADMIN_PASSWORD)."
                : " No password configured yet."}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-muted">
            Current password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={adminForm.currentPassword}
            onChange={(e) =>
              setAdminForm({ ...adminForm, currentPassword: e.target.value })
            }
            className="input-field"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              New password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={adminForm.newPassword}
              onChange={(e) =>
                setAdminForm({ ...adminForm, newPassword: e.target.value })
              }
              className="input-field"
              minLength={4}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Confirm new password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={adminForm.confirmPassword}
              onChange={(e) =>
                setAdminForm({ ...adminForm, confirmPassword: e.target.value })
              }
              className="input-field"
              minLength={4}
              required
            />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={savingAdmin}>
          {savingAdmin ? "Saving…" : "Update admin password"}
        </button>
      </form>

      <form onSubmit={onSavePayment} className="card space-y-4">
        <div>
          <h3 className="font-bold text-brand-heading">Payment QR password</h3>
          <p className="mt-1 text-sm text-brand-muted">
            Extra lock for the Payment QR section.
            {status?.paymentQrPasswordCustomized
              ? " Currently using a password saved from Settings."
              : " If not set here, the admin password (or PAYMENT_QR_PASSWORD env) is used."}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-muted">
            Current password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={paymentForm.currentPassword}
            onChange={(e) =>
              setPaymentForm({ ...paymentForm, currentPassword: e.target.value })
            }
            className="input-field"
            required
          />
          <p className="mt-1 text-xs text-brand-muted">
            Enter the current Payment QR password, or the admin password if you
            haven&apos;t set a separate one yet.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              New password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={paymentForm.newPassword}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, newPassword: e.target.value })
              }
              className="input-field"
              minLength={4}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Confirm new password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={paymentForm.confirmPassword}
              onChange={(e) =>
                setPaymentForm({
                  ...paymentForm,
                  confirmPassword: e.target.value,
                })
              }
              className="input-field"
              minLength={4}
              required
            />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={savingPayment}>
          {savingPayment ? "Saving…" : "Update Payment QR password"}
        </button>
      </form>
    </div>
  );
}
