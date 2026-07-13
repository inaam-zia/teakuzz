"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DeveloperCredit from "@/components/developer-credit";
import TableHeading from "@/components/table-heading";
import { formatDate, formatPrice } from "@/lib/format";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { normalizePhone } from "@/lib/phone";
import type { CustomerIdentity } from "@/lib/auth";
import type { OrderWithItems } from "@/lib/types";

type Props = {
  cafeName: string;
};

type Channel = "email" | "phone";
type Step = "loading" | "verify" | "otp" | "orders";

type MyOrdersResponse = {
  mode?: "recent" | "verified";
  identity?: CustomerIdentity;
  orders?: OrderWithItems[];
  error?: string;
};

const STATUS_LABELS: Record<string, string> = {
  new: "Received",
  preparing: "Preparing",
  served: "Served",
  cancelled: "Cancelled",
};

function OrderCard({ order }: { order: OrderWithItems }) {
  return (
    <div className="rounded-2xl border border-cafe-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-cafe-900">
            <TableHeading
              tableNumber={order.table_number}
              tableName={order.table_label}
              size="md"
            />
            {order.customer_name && (
              <span className="font-medium text-cafe-600">
                {" "}
                · {order.customer_name}
              </span>
            )}
          </p>
          <p className="text-sm text-cafe-500">{formatDate(order.created_at)}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-cafe-700">{formatPrice(order.total)}</p>
          <p className="text-xs text-cafe-500">{STATUS_LABELS[order.status] || order.status}</p>
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
  );
}

export default function MyOrdersClient({ cafeName }: Props) {
  const searchParams = useSearchParams();
  const forceVerify = searchParams.get("all") === "1";

  const [step, setStep] = useState<Step>("loading");
  const [channel, setChannel] = useState<Channel>("email");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [mode, setMode] = useState<"recent" | "verified" | null>(null);
  const [identity, setIdentity] = useState<CustomerIdentity | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState("");

  async function loadOrders(skipVerify = false) {
    setError("");
    const res = await fetch("/api/my-orders");
    const data = (await res.json()) as MyOrdersResponse;

    if (res.status === 401 || (forceVerify && !skipVerify)) {
      setStep("verify");
      return;
    }

    if (!res.ok || data.error) {
      setError(data.error || "Could not load orders");
      setStep("verify");
      return;
    }

    setMode(data.mode ?? "verified");
    setIdentity(data.identity ?? null);
    setOrders(data.orders ?? []);
    setStep("orders");
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setDevCode("");
    setSending(true);

    const body =
      channel === "email"
        ? { channel: "email", email: normalizeEmail(email) }
        : { channel: "phone", phone: normalizePhone(phone) };

    if (channel === "email" && !isValidEmail(email)) {
      setSending(false);
      setError("Please enter a valid email");
      return;
    }

    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(data.error || "Could not send code");
      if (data.useEmail && channel === "phone") {
        setInfo("Tip: use email instead — it's free and works without an SMS provider.");
      }
      return;
    }

    if (data.devCode) {
      setDevCode(data.devCode);
      setInfo(
        channel === "email"
          ? "Dev mode: email not configured, use the code shown below."
          : "Dev mode: SMS not configured, use the code shown below."
      );
    } else {
      setInfo(
        channel === "email"
          ? "We sent a 6-digit code to your email."
          : "We sent a 6-digit code to your phone."
      );
    }

    setOtp("");
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifying(true);

    const body =
      channel === "email"
        ? { channel: "email", email: normalizeEmail(email), code: otp }
        : { channel: "phone", phone: normalizePhone(phone), code: otp };

    const res = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setVerifying(false);

    if (!res.ok) {
      setError(data.error || "Verification failed");
      return;
    }

    await loadOrders(true);
  }

  async function logout() {
    await fetch("/api/my-orders", { method: "DELETE" });
    setOrders([]);
    setPhone("");
    setEmail("");
    setOtp("");
    setDevCode("");
    setInfo("");
    setError("");
    setMode(null);
    setIdentity(null);
    setStep("verify");
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
            <h1 className="mt-2 text-2xl font-bold text-cafe-900">My orders</h1>
            <p className="mt-2 text-sm text-cafe-600">
              {step === "orders" && mode === "recent"
                ? "Your most recent order on this device"
                : step === "orders"
                  ? "Orders linked to your verified account"
                  : "Verify with email (free) or phone to see past orders"}
            </p>
          </div>

          {step === "verify" && (
            <div className="space-y-4">
              <div className="flex rounded-xl bg-cafe-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setChannel("email");
                    setError("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                    channel === "email"
                      ? "bg-white text-cafe-900 shadow-sm"
                      : "text-cafe-500"
                  }`}
                >
                  Email (free)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChannel("phone");
                    setError("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                    channel === "phone"
                      ? "bg-white text-cafe-900 shadow-sm"
                      : "text-cafe-500"
                  }`}
                >
                  Phone (SMS)
                </button>
              </div>

              <form onSubmit={sendOtp} className="space-y-4">
                {channel === "email" ? (
                  <div>
                    <label htmlFor="lookup-email" className="order-label">
                      Email address
                    </label>
                    <input
                      id="lookup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="order-input"
                      autoComplete="email"
                      required
                    />
                    <p className="mt-1.5 text-xs leading-relaxed text-cafe-500">
                      Use the same email you added when ordering. We&apos;ll send a free
                      verification code.
                    </p>
                  </div>
                ) : (
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
                      SMS OTP needs a paid provider. If you added an email when ordering,
                      use the Email tab instead.
                    </p>
                  </div>
                )}

                {error && <p className="text-center text-sm text-red-600">{error}</p>}
                {info && !error && (
                  <p className="rounded-xl bg-cafe-50 px-4 py-3 text-center text-sm text-cafe-600">
                    {info}
                  </p>
                )}

                <button type="submit" disabled={sending} className="order-btn w-full">
                  {sending ? "Sending code…" : "Send verification code"}
                </button>
              </form>
            </div>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <p className="text-center text-sm text-cafe-600">
                Code sent to{" "}
                <strong>
                  {channel === "email"
                    ? normalizeEmail(email)
                    : `+91 ${normalizePhone(phone)}`}
                </strong>
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
                  setStep("verify");
                  setError("");
                  setInfo("");
                }}
                className="order-btn-secondary w-full"
              >
                Use a different {channel === "email" ? "email" : "number"}
              </button>
            </form>
          )}

          {step === "orders" && (
            <div className="space-y-4">
              {mode === "recent" ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-medium">Recent order on this device</p>
                  <p className="mt-1 text-amber-800/80">
                    To see all past orders, verify with the email or phone you used when
                    ordering.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep("verify")}
                    className="mt-2 font-semibold underline-offset-2 hover:underline"
                  >
                    Look up all past orders →
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-cafe-50 px-4 py-3 text-sm text-cafe-600">
                  <span>
                    Verified ·{" "}
                    <strong className="text-cafe-900">
                      {identity?.type === "email"
                        ? identity.value
                        : `+91 ${identity?.value || normalizePhone(phone)}`}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="font-medium text-cafe-700 underline-offset-2 hover:underline"
                  >
                    Sign out
                  </button>
                </div>
              )}

              {error && <p className="text-center text-sm text-red-600">{error}</p>}

              {orders.length === 0 ? (
                <div className="rounded-xl border border-cafe-200 bg-cafe-50/50 px-4 py-10 text-center text-sm text-cafe-600">
                  <p className="font-medium text-cafe-800">No orders found</p>
                  <p className="mt-2">
                    Orders only show up if you used this {channel} when you placed them.
                  </p>
                  <Link href="/" className="order-btn-secondary mt-6 inline-flex w-full">
                    Scan table QR to order
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
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
        <DeveloperCredit className="mt-4" />
      </div>
    </main>
  );
}
