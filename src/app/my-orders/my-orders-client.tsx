"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate, formatPrice } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import type { OrderWithItems } from "@/lib/types";

type Props = {
  cafeName: string;
};

type Step = "loading" | "phone" | "otp" | "orders";

type MyOrdersResponse = {
  phone?: string;
  orders?: OrderWithItems[];
  error?: string;
};

const STATUS_LABELS: Record<string, string> = {
  new: "Received",
  preparing: "Preparing",
  served: "Served",
  cancelled: "Cancelled",
};

export default function MyOrdersClient({ cafeName }: Props) {
  const [step, setStep] = useState<Step>("loading");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState("");

  async function loadOrders() {
    setError("");
    const res = await fetch("/api/my-orders");
    const data = (await res.json()) as MyOrdersResponse;

    if (res.status === 401) {
      setStep("phone");
      return;
    }

    if (!res.ok || data.error) {
      setError(data.error || "Could not load orders");
      setStep("phone");
      return;
    }

    if (data.phone) {
      setPhone(data.phone);
    }

    setOrders(data.orders ?? []);
    setStep("orders");
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setDevCode("");
    setSending(true);

    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizePhone(phone) }),
    });

    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(data.error || "Could not send code");
      return;
    }

    if (data.devCode) {
      setDevCode(data.devCode);
      setInfo("Dev mode: SMS not configured, use the code shown below.");
    } else {
      setInfo("We sent a 6-digit code to your phone.");
    }

    setOtp("");
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifying(true);

    const res = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: normalizePhone(phone),
        code: otp,
      }),
    });

    const data = await res.json();
    setVerifying(false);

    if (!res.ok) {
      setError(data.error || "Verification failed");
      return;
    }

    await loadOrders();
  }

  async function logout() {
    await fetch("/api/my-orders", { method: "DELETE" });
    setOrders([]);
    setPhone("");
    setOtp("");
    setDevCode("");
    setInfo("");
    setError("");
    setStep("phone");
  }

  if (step === "loading") {
    return (
      <main className="order-bg flex min-h-screen items-center justify-center px-5">
        <p className="text-cafe-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="order-bg flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-lg flex-1 px-5 py-10">
        <div className="order-hero-card">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-cafe-500">
              {cafeName}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-cafe-900">My past orders</h1>
            <p className="mt-2 text-sm text-cafe-600">
              {step === "orders"
                ? "Orders linked to your verified phone number"
                : "Verify your phone to see orders you placed here before"}
            </p>
          </div>

          {step === "phone" && (
            <form onSubmit={sendOtp} className="space-y-4">
              <div>
                <label htmlFor="lookup-phone" className="order-label">
                  Phone number
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cafe-400">
                    +91
                  </span>
                  <input
                    id="lookup-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="order-input pl-14"
                    autoComplete="tel"
                    required
                  />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-cafe-500">
                  We&apos;ll send a one-time code to confirm it&apos;s you. Only used for
                  looking up your orders.
                </p>
              </div>

              {error && <p className="text-center text-sm text-red-600">{error}</p>}

              <button type="submit" disabled={sending} className="order-btn w-full">
                {sending ? "Sending code…" : "Send verification code"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <p className="text-center text-sm text-cafe-600">
                Code sent to <strong>+91 {normalizePhone(phone)}</strong>
              </p>

              {info && (
                <p className="rounded-xl bg-cafe-50 px-4 py-3 text-center text-sm text-cafe-600">
                  {info}
                  {devCode && (
                    <>
                      {" "}
                      <strong className="text-cafe-900">{devCode}</strong>
                    </>
                  )}
                </p>
              )}

              <div>
                <label htmlFor="otp" className="order-label">
                  Verification code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="order-input text-center text-lg tracking-[0.3em]"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              {error && <p className="text-center text-sm text-red-600">{error}</p>}

              <button type="submit" disabled={verifying} className="order-btn w-full">
                {verifying ? "Verifying…" : "Verify & view orders"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setError("");
                  setInfo("");
                }}
                className="order-btn-secondary w-full"
              >
                Use a different number
              </button>
            </form>
          )}

          {step === "orders" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-cafe-50 px-4 py-3 text-sm text-cafe-600">
                <span>
                  Verified ·{" "}
                  <strong className="text-cafe-900">+91 {normalizePhone(phone)}</strong>
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="font-medium text-cafe-700 underline-offset-2 hover:underline"
                >
                  Sign out
                </button>
              </div>

              {error && <p className="text-center text-sm text-red-600">{error}</p>}

              {orders.length === 0 ? (
                <div className="rounded-xl border border-cafe-200 bg-cafe-50/50 px-4 py-10 text-center text-sm text-cafe-600">
                  <p className="font-medium text-cafe-800">No orders found</p>
                  <p className="mt-2">
                    Orders only show up if you added this phone number when you placed them.
                  </p>
                  <Link href="/" className="order-btn-secondary mt-6 inline-flex w-full">
                    Scan table QR to order
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-cafe-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-cafe-900">
                            Table {order.table_number}
                            {order.customer_name && ` · ${order.customer_name}`}
                          </p>
                          <p className="text-sm text-cafe-500">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-cafe-700">{formatPrice(order.total)}</p>
                          <p className="text-xs text-cafe-500">
                            {STATUS_LABELS[order.status] || order.status}
                          </p>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-1 border-t border-cafe-100 pt-3 text-sm text-cafe-600">
                        {order.order_items.map((item) => (
                          <li key={item.id}>
                            {item.quantity}× {item.item_name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-cafe-400">
          <Link href="/" className="hover:text-cafe-600">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
