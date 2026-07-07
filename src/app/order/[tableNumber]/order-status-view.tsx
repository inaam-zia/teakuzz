"use client";

import { useCallback, useEffect, useState } from "react";
import CafeBrandingBlock from "@/components/cafe-branding-block";
import { formatPrice } from "@/lib/format";
import type { CafeBranding } from "@/lib/branding-types";
import type { OrderItem, OrderStatus, OrderWithItems } from "@/lib/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Received",
  preparing: "Preparing",
  served: "Served",
  cancelled: "Cancelled",
};

const STATUS_STEPS: OrderStatus[] = ["new", "preparing", "served"];

type DishFeedback = {
  order_item_id: string;
  order_id: string;
  item_name: string;
  rating: number;
  comment: string | null;
};

function StatusTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-700">
        Order cancelled
      </p>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(status);

  return (
    <div className="flex items-center justify-between gap-1">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? active
                    ? "ring-2 ring-[var(--brand-primary)] ring-offset-2"
                    : ""
                  : "opacity-40"
              }`}
              style={{
                backgroundColor: done ? "var(--brand-primary)" : "var(--brand-border)",
                color: done ? "var(--brand-button-text)" : "var(--brand-muted)",
              }}
            >
              {idx + 1}
            </div>
            <span
              className={`text-center text-[10px] font-medium leading-tight ${
                active ? "text-brand-heading" : "text-brand-subtle"
              }`}
            >
              {STATUS_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Rate this dish">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`text-xl leading-none transition ${
            star <= value ? "text-amber-500" : "text-cafe-300"
          } disabled:cursor-not-allowed`}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function DishFeedbackForm({
  item,
  tableNumber,
  existing,
  onSubmitted,
}: {
  item: OrderItem;
  tableNumber: number;
  existing?: DishFeedback;
  onSubmitted: (feedback: DishFeedback) => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submitted = Boolean(existing);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Please select a star rating");
      return;
    }

    setError("");
    setSubmitting(true);

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber,
        orderItemId: item.id,
        rating,
        comment,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Could not save feedback");
      return;
    }

    onSubmitted({
      order_item_id: item.id,
      order_id: item.order_id,
      item_name: item.item_name,
      rating,
      comment: comment.trim() || null,
    });
  }

  if (submitted) {
    return (
      <li className="rounded-xl bg-cafe-50 px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-brand-heading">
              {item.quantity}× {item.item_name}
            </p>
            <p className="mt-1 text-xs text-green-700">Thanks for your feedback!</p>
          </div>
          <div className="text-amber-500" aria-label={`Rated ${existing!.rating} stars`}>
            {"★".repeat(existing!.rating)}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-cafe-200 bg-cafe-50/80 px-3 py-3">
      <form onSubmit={handleSubmit}>
        <p className="text-sm font-medium text-brand-heading">
          {item.quantity}× {item.item_name}
        </p>
        <p className="mt-1 text-xs text-brand-muted">How was this dish?</p>
        <div className="mt-2">
          <StarRating value={rating} disabled={submitting} onChange={setRating} />
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment…"
          rows={2}
          className="order-input mt-2 min-h-[60px] text-sm"
          disabled={submitting}
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || rating < 1}
          className="order-btn mt-3 w-full py-2.5 text-sm"
        >
          {submitting ? "Saving…" : "Submit feedback"}
        </button>
      </form>
    </li>
  );
}

function OrderCard({
  order,
  tableNumber,
  feedbackByItemId,
  onFeedbackSubmitted,
}: {
  order: OrderWithItems;
  tableNumber: number;
  feedbackByItemId: Map<string, DishFeedback>;
  onFeedbackSubmitted: (feedback: DishFeedback) => void;
}) {
  const showFeedback = order.status === "served";

  return (
    <div className="rounded-2xl border border-brand bg-brand-surface p-4 shadow-sm">
      <div className="mb-4">
        <StatusTimeline status={order.status} />
      </div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-heading">
          {STATUS_LABELS[order.status]}
        </p>
        <p className="font-bold text-brand-muted">{formatPrice(order.total)}</p>
      </div>

      {showFeedback ? (
        <div className="border-t border-brand pt-3">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-subtle">
            Rate your dishes
          </p>
          <ul className="space-y-2">
            {order.order_items.map((item) => (
              <DishFeedbackForm
                key={item.id}
                item={item}
                tableNumber={tableNumber}
                existing={feedbackByItemId.get(item.id)}
                onSubmitted={onFeedbackSubmitted}
              />
            ))}
          </ul>
        </div>
      ) : (
        <ul className="space-y-2 border-t border-brand pt-3">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span className="text-brand-heading">
                {item.quantity}× {item.item_name}
              </span>
              <span className="text-brand-muted">
                {formatPrice(item.item_price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  tableNumber: number;
  customerName: string;
  branding: CafeBranding;
  onAddMore: () => void;
};

export default function OrderStatusView({ tableNumber, customerName, branding, onAddMore }: Props) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackByItemId, setFeedbackByItemId] = useState<Map<string, DishFeedback>>(
    new Map()
  );

  const loadFeedback = useCallback(async () => {
    const res = await fetch(`/api/feedback?table=${tableNumber}`);
    if (!res.ok) return;
    const data = await res.json();
    const map = new Map<string, DishFeedback>();
    for (const row of (data.feedback ?? []) as DishFeedback[]) {
      map.set(row.order_item_id, row);
    }
    setFeedbackByItemId(map);
  }, [tableNumber]);

  async function loadOrders() {
    const res = await fetch(`/api/orders/my-active?table=${tableNumber}`);
    if (!res.ok) return;
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadFeedback();
    void loadOrders();
    const interval = setInterval(() => {
      void loadOrders();
      void loadFeedback();
    }, 5000);
    return () => clearInterval(interval);
  }, [tableNumber, loadFeedback]);

  function handleFeedbackSubmitted(feedback: DishFeedback) {
    setFeedbackByItemId((prev) => {
      const next = new Map(prev);
      next.set(feedback.order_item_id, feedback);
      return next;
    });
  }

  const allServed =
    orders.length > 0 && orders.every((o) => o.status === "served" || o.status === "cancelled");

  return (
    <main className="order-bg mx-auto min-h-screen max-w-lg px-5 py-8">
      <div className="mb-6">
        <CafeBrandingBlock branding={branding} logoSize="md" showTagline align="center" />
      </div>
      <div className="order-hero-card space-y-6">
        <div className="text-center">
          <div className="success-check">✓</div>
          <h1 className="text-2xl font-bold text-brand-heading">Order placed!</h1>
          <p className="mt-2 text-sm text-brand-muted">
            Thanks {customerName.split(" ")[0]} — we&apos;ll bring it to{" "}
            <strong>Table {tableNumber}</strong>
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-subtle">
            Your order status
          </h2>
          {loading ? (
            <p className="text-center text-sm text-brand-muted">Loading status…</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-sm text-brand-muted">No active orders</p>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                tableNumber={tableNumber}
                feedbackByItemId={feedbackByItemId}
                onFeedbackSubmitted={handleFeedbackSubmitted}
              />
            ))
          )}
        </div>

        {allServed && orders.length > 0 && (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm text-green-800">
            Enjoy your meal! Rate your dishes to help us improve.
          </p>
        )}

        <button type="button" onClick={onAddMore} className="order-btn w-full">
          Add more items
        </button>

        <p className="text-center text-xs text-brand-subtle">
          Status updates automatically every few seconds
        </p>
      </div>
    </main>
  );
}
