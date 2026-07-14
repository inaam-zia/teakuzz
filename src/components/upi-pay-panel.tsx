"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { UpiPayParams } from "@/lib/payment-qr";
import { formatReceiptGrandTotal } from "@/lib/receipt";

type Props = {
  upi: UpiPayParams;
  /** Optional static café QR (no amount). Prefer dynamic amount QR when available. */
  fallbackQrUrl?: string | null;
  fallbackQrLabel?: string | null;
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export default function UpiPayPanel({
  upi,
  fallbackQrUrl,
  fallbackQrLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [amountQrUrl, setAmountQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"upi" | "amount" | null>(null);
  const amountLabel = formatReceiptGrandTotal(upi.amount);
  const amountPlain = upi.amount.toFixed(2);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setAmountQrUrl(null);
    const params = new URLSearchParams({
      pa: upi.upiId,
      am: amountPlain,
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
        /* ignore */
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [upi.upiId, amountPlain, upi.payeeName, upi.note]);

  const qrSrc = amountQrUrl || fallbackQrUrl || null;

  async function handleCopy(kind: "upi" | "amount") {
    const text = kind === "upi" ? upi.upiId : amountPlain;
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  }

  const sheet =
    open && mounted
      ? createPortal(
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
              <p className="upi-sheet__hint">
                Opening GPay / PhonePe from the browser often fails for security.
                Use scan or copy instead.
              </p>

              {qrSrc ? (
                <div className="upi-sheet__qr-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    alt={`Scan to pay ${amountLabel}`}
                    className="upi-sheet__qr"
                  />
                  <p className="upi-sheet__steps">
                    1. Open GPay, PhonePe, or Paytm
                    <br />
                    2. Tap Scan QR
                    <br />
                    3. Amount {amountLabel} is already filled
                  </p>
                </div>
              ) : (
                <p className="upi-sheet__hint">
                  Scan QR is unavailable — copy UPI ID and amount below.
                </p>
              )}

              <div className="upi-sheet__copy-row">
                <div className="upi-sheet__copy-block">
                  <p className="upi-sheet__copy-label">UPI ID</p>
                  <p className="upi-sheet__copy-value">{upi.upiId}</p>
                  <button
                    type="button"
                    className="upi-sheet__copy-btn"
                    onClick={() => handleCopy("upi")}
                  >
                    {copied === "upi" ? "Copied" : "Copy UPI ID"}
                  </button>
                </div>
                <div className="upi-sheet__copy-block">
                  <p className="upi-sheet__copy-label">Amount</p>
                  <p className="upi-sheet__copy-value">₹{amountPlain}</p>
                  <button
                    type="button"
                    className="upi-sheet__copy-btn"
                    onClick={() => handleCopy("amount")}
                  >
                    {copied === "amount" ? "Copied" : "Copy amount"}
                  </button>
                </div>
              </div>

              {upi.payeeName ? (
                <p className="upi-sheet__payee">Pay to: {upi.payeeName}</p>
              ) : null}

              {!amountQrUrl && fallbackQrLabel ? (
                <p className="upi-sheet__hint">{fallbackQrLabel}</p>
              ) : null}

              <button
                type="button"
                className="upi-sheet__cancel"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="thermal-receipt__pay">
      <button
        type="button"
        className="thermal-receipt__pay-button"
        onClick={() => setOpen(true)}
      >
        Pay {amountLabel}
      </button>
      <p className="thermal-receipt__pay-hint">
        Scan QR in your UPI app — more reliable than opening the app from here
      </p>

      {qrSrc ? (
        <>
          <p className="thermal-receipt__pay-or">scan with any UPI app</p>
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
              Amount {amountLabel} is included in this QR
            </p>
          ) : (
            <p className="thermal-receipt__pay-hint">
              Enter {amountLabel} after scanning
            </p>
          )}
        </>
      ) : null}

      {sheet}
    </div>
  );
}
