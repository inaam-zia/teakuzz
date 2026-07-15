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
  const [upiId, setUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUpiId, setEditUpiId] = useState("");
  const [editPayeeName, setEditPayeeName] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/admin/payment-qr");

    if (res.status === 403) {
      setUnlocked(false);
      setCodes([]);
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load payment QR codes");
      return;
    }
    setCodes(data.codes ?? []);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lock() {
    await fetch("/api/admin/payment-qr/unlock", { method: "DELETE" });
    setCodes([]);
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
    fd.append("upiId", upiId);
    fd.append("payeeName", payeeName);
    fd.append("setActive", "true");

    const res = await fetch("/api/admin/payment-qr", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error || "Could not upload QR");
      return;
    }

    setLabel("");
    setUpiId("");
    setPayeeName("");
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

  function startEditUpi(code: PaymentQrCode) {
    setEditingId(code.id);
    setEditUpiId(code.upi_id ?? "");
    setEditPayeeName(code.payee_name ?? "");
    setError("");
    setSuccess("");
  }

  async function saveUpi(id: string) {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/admin/payment-qr/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upiId: editUpiId, payeeName: editPayeeName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save UPI details");
      return;
    }
    setEditingId(null);
    setSuccess("UPI details saved. Customers can now tap to pay.");
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
          Lock sections
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              UPI ID (for tap-to-pay)
            </label>
            <input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="input-field"
              placeholder="yourcafe@okhdfc"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Payee name (optional)
            </label>
            <input
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              className="input-field"
              placeholder="Teakuzz Cafe"
            />
          </div>
        </div>
        <p className="text-xs text-brand-subtle">
          Add your UPI ID to show a &ldquo;Pay now&rdquo; button on customer bills that opens
          their UPI app with the exact amount pre-filled.
        </p>
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
                className={`rounded-xl border p-4 ${
                  code.is_active ? "border-green-300 bg-green-50/50" : "border-brand"
                }`}
              >
                <div className="flex flex-wrap items-center gap-4">
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
                    {code.upi_id ? (
                      <p className="mt-1 text-xs text-brand-muted">
                        Tap-to-pay: <span className="font-medium">{code.upi_id}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-amber-700">
                        No UPI ID — only the QR image will show (no tap-to-pay)
                      </p>
                    )}
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
                      onClick={() =>
                        editingId === code.id ? setEditingId(null) : startEditUpi(code)
                      }
                      className="btn-secondary py-2 text-xs"
                    >
                      {editingId === code.id ? "Cancel" : "Edit UPI"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(code.id)}
                      className="btn-secondary py-2 text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === code.id && (
                  <div className="mt-4 grid gap-3 border-t border-brand pt-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-brand-muted">
                        UPI ID
                      </label>
                      <input
                        value={editUpiId}
                        onChange={(e) => setEditUpiId(e.target.value)}
                        className="input-field"
                        placeholder="yourcafe@okhdfc"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-brand-muted">
                        Payee name (optional)
                      </label>
                      <input
                        value={editPayeeName}
                        onChange={(e) => setEditPayeeName(e.target.value)}
                        className="input-field"
                        placeholder="Teakuzz Cafe"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => saveUpi(code.id)}
                        className="btn-primary py-2 text-xs"
                      >
                        Save UPI details
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
