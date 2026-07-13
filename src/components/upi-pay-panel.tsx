"use client";

import { useEffect, useState } from "react";
import { buildUpiAppLinks, type UpiPayParams } from "@/lib/payment-qr";
import { formatReceiptGrandTotal } from "@/lib/receipt";

type Props = {
  upi: UpiPayParams;
  /** Optional static café QR (no amount). Prefer dynamic amount QR when available. */
  fallbackQrUrl?: string | null;
  fallbackQrLabel?: string | null;
};

export default function UpiPayPanel({
  upi,
  fallbackQrUrl,
  fallbackQrLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [amountQrUrl, setAmountQrUrl] = useState<string | null>(null);
  const apps = buildUpiAppLinks(upi);
  const amountLabel = formatReceiptGrandTotal(upi.amount);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setAmountQrUrl(null);
    const params = new URLSearchParams({
      pa: upi.upiId,
      am: upi.amount.toFixed(2),
    });
    if (upi.payeeName) params.set("pn", upi.payeeName);
    if (upi.note) params.set("tn", upi.note);

    fetch(`/api/payment-qr/upi-image?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      })
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        if (url) setAmountQrUrl(url);
      })
      .catch(() => {
        /* ignore — fallback QR / app links still work */
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [upi.upiId, upi.amount, upi.payeeName, upi.note]);

  const qrSrc = amountQrUrl || fallbackQrUrl || null;

  return (
    <div className="thermal-receipt__pay">
      <button
        type="button"
        className="thermal-receipt__pay-button"
        onClick={() => setOpen(true)}
      >
        Pay {amountLabel} now
      </button>
      <p className="thermal-receipt__pay-hint">
        Choose GPay, PhonePe, Paytm, or any UPI app — amount is filled in
      </p>

      {qrSrc ? (
        <>
          <p className="thermal-receipt__pay-or">or scan to pay {amountLabel}</p>
          {fallbackQrLabel && !amountQrUrl ? (
            <p className="thermal-receipt__pay-label">{fallbackQrLabel}</p>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`Pay ${amountLabel} via UPI`}
            className="thermal-receipt__pay-qr"
          />
          {amountQrUrl ? (
            <p className="thermal-receipt__pay-hint">
              This QR includes your bill amount
            </p>
          ) : null}
        </>
      ) : null}

      {open ? (
        <div
          className="upi-sheet-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="upi-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upi-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="upi-sheet-title" className="upi-sheet__title">
              Pay {amountLabel}
            </h3>
            <p className="upi-sheet__hint">Open with</p>
            <ul className="upi-sheet__list">
              {apps.map((app) => (
                <li key={app.id}>
                  <a
                    href={app.href}
                    className="upi-sheet__app"
                    onClick={() => setOpen(false)}
                  >
                    {app.label}
                  </a>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="upi-sheet__cancel"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
