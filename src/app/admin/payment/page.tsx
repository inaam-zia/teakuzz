"use client";

import { useEffect, useState } from "react";
import type { PaymentQrCode } from "@/lib/payment-qr";
import { usePaymentLock } from "../payment-lock-context";

export default function PaymentQrPage() {
  const { setUnlocked } = usePaymentLock();
  const [codes, setCodes] = useState<PaymentQrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [locked, setLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  async function load() {
    setError("");
    const res = await fetch("/api/admin/payment-qr");

    if (res.status === 403) {
      setLocked(true);
      setUnlocked(false);
      setCodes([]);
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load payment QR codes");
      return;
    }
    setLocked(false);
    setUnlocked(true);
    setCodes(data.codes ?? []);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError("");

    const res = await fetch("/api/admin/payment-qr/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: unlockPassword }),
    });
    const data = await res.json();
    setUnlocking(false);

    if (!res.ok) {
      setUnlockError(data.error || "Wrong password");
      return;
    }

    setUnlockPassword("");
    setLocked(false);
    setUnlocked(true);
    await load();
  }

  async function lock() {
    await fetch("/api/admin/payment-qr/unlock", { method: "DELETE" });
    setCodes([]);
    setLocked(true);
    setUnlocked(false);
    setSuccess("");
    setError("");
  }

  async function upload(file: File) {
    setUploading(true);
    setError("");
    setSuccess("");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("label", label);
    fd.append("setActive", "true");

    const res = await fetch("/api/admin/payment-qr", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error || "Could not upload QR");
      return;
    }

    setLabel("");
    setSuccess("Payment QR uploaded and set as active.");
    await load();
  }

  async function activate(id: string) {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/admin/payment-qr/${id}`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not activate QR");
      return;
    }
    setSuccess("Active payment QR updated.");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this payment QR?")) return;
    setError("");
    setSuccess("");
    const res = await fetch(`/api/admin/payment-qr/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete QR");
      return;
    }
    setSuccess("Payment QR deleted.");
    await load();
  }

  const active = codes.find((c) => c.is_active);

  if (loading) {
    return <p className="text-brand-muted">Loading…</p>;
  }

  if (locked) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-heading">Payment QR</h2>
          <p className="text-brand-muted">
            This section is locked. Enter the payment QR password to manage payment codes.
          </p>
        </div>

        <form onSubmit={unlock} className="card space-y-4">
          <div>
            <label
              htmlFor="payment-qr-password"
              className="mb-1 block text-sm font-medium text-brand-muted"
            >
              Payment QR password
            </label>
            <input
              id="payment-qr-password"
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              className="input-field"
              placeholder="Enter password"
              autoFocus
              required
            />
          </div>

          {unlockError && <p className="text-sm text-red-600">{unlockError}</p>}

          <button type="submit" disabled={unlocking} className="btn-primary w-full">
            {unlocking ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-brand-heading">Payment QR</h2>
          <p className="text-brand-muted">
            Upload your UPI or payment QR. Only one QR is active at a time — it appears on
            customer bills when their order is served.
          </p>
        </div>
        <button type="button" onClick={lock} className="btn-secondary shrink-0">
          Lock
        </button>
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

      <section className="card space-y-4">
        <h3 className="font-bold text-brand-heading">Upload new QR</h3>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-muted">
            Label (optional, e.g. PhonePe, GPay)
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input-field"
            placeholder="UPI QR"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-muted">QR image</label>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            className="text-sm"
          />
          <p className="mt-1 text-xs text-brand-subtle">
            PNG or JPG, max 2 MB. New uploads are set active automatically (replaces the
            current active QR).
          </p>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-brand-heading">Saved QR codes</h3>
          {active ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              1 active
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              No active QR
            </span>
          )}
        </div>

        {codes.length === 0 ? (
          <p className="text-sm text-brand-muted">
            No payment QR yet. Upload one above to show it on served bills.
          </p>
        ) : (
          <ul className="space-y-3">
            {codes.map((code) => (
              <li
                key={code.id}
                className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 ${
                  code.is_active ? "border-green-300 bg-green-50/50" : "border-brand"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={code.image_url}
                  alt=""
                  className="h-24 w-24 rounded-lg border border-brand bg-white object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-brand-heading">
                    {code.label || "Payment QR"}
                    {code.is_active && (
                      <span className="ml-2 text-xs font-bold uppercase text-green-700">
                        Active
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-brand-subtle">
                    Added {new Date(code.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!code.is_active && (
                    <button
                      type="button"
                      onClick={() => activate(code.id)}
                      className="btn-primary py-2 text-xs"
                    >
                      Set active
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(code.id)}
                    className="btn-secondary py-2 text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
