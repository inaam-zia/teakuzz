/**
 * Open a print window for an RP82 (and similar) 3" / 80mm thermal receipt.
 * Keeps the window open and shows the system print dialog.
 */
export function printThermalBill(receiptEl: HTMLElement | null, title = "Bill") {
  if (!receiptEl || typeof window === "undefined") return;

  // Must open during the click (no noopener) so the OS print dialog can attach
  // to a real window that stays open.
  const win = window.open("", "_blank", "width=360,height=800");
  if (!win) {
    window.alert(
      "Could not open the print window. Allow pop-ups for this site, then try Print bill again."
    );
    return;
  }

  const clone = receiptEl.cloneNode(true) as HTMLElement;
  // Interactive pay UI is useless on paper
  clone.querySelectorAll(".thermal-receipt__pay").forEach((el) => el.remove());

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    /* RP82 · 3" (≈80mm) thermal receipt — high contrast, safe margins */
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
    }
    body {
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 2mm 0 4mm;
    }
    .no-print-hint {
      text-align: center;
      font: 12px system-ui, -apple-system, Segoe UI, sans-serif;
      color: #000;
      margin: 0 0 8px;
      padding: 0 2mm;
    }
    .thermal-receipt {
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      border: none;
      background: #fff;
      padding: 1.5mm 2.5mm;
      font-family: "Courier New", Courier, ui-monospace, monospace;
      font-size: 12px;
      line-height: 1.3;
      font-weight: 700;
      color: #000;
      overflow: visible;
    }
    .thermal-receipt *:not(img),
    .thermal-receipt *::before,
    .thermal-receipt *::after {
      color: #000 !important;
      border-color: #000 !important;
      box-shadow: none !important;
      max-width: 100%;
    }
    .thermal-receipt img {
      max-width: 100%;
      height: auto;
    }
    .thermal-receipt__header { text-align: center; }
    .thermal-receipt__logo {
      display: block;
      margin: 0 auto 3mm;
      height: 10mm;
      width: 10mm;
      max-width: 10mm;
      object-fit: contain;
      filter: grayscale(1) contrast(1.4);
    }
    .thermal-receipt__brand {
      margin: 0 0 1mm;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .thermal-receipt__address {
      margin: 0;
      font-size: 10px;
      line-height: 1.25;
      font-weight: 700;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .thermal-receipt__gst {
      margin: 1.5mm 0 0;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.01em;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .thermal-receipt__qty-line {
      margin-bottom: 1mm;
      font-size: 11px;
      font-weight: 700;
    }
    .thermal-receipt__gst-line,
    .thermal-receipt__subtotal,
    .thermal-receipt__grand-total,
    .thermal-receipt__name-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 2mm;
      width: 100%;
    }
    .thermal-receipt__gst-line {
      margin-top: 0.8mm;
      font-size: 11px;
      font-weight: 700;
    }
    .thermal-receipt__gst-line > span:first-child,
    .thermal-receipt__subtotal > span:first-child,
    .thermal-receipt__grand-total > span:first-child,
    .thermal-receipt__name-row > span:first-child {
      min-width: 0;
      flex: 1 1 auto;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .thermal-receipt__gst-line > span:last-child,
    .thermal-receipt__subtotal > span:last-child,
    .thermal-receipt__grand-total > span:last-child {
      flex: 0 0 auto;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .thermal-receipt__rule {
      margin: 2mm 0;
      border: 0;
      border-top: 1px dashed #000;
      height: 0;
    }
    .thermal-receipt__rule--thick {
      border-top: 2px solid #000;
    }
    .thermal-receipt__name-row {
      font-weight: 700;
      font-size: 12px;
    }
    .thermal-receipt__name-value {
      flex: 1 1 auto;
      min-width: 0;
      border-bottom: 1px solid #000;
      padding-bottom: 0.5mm;
      font-weight: 700;
      overflow-wrap: anywhere;
      word-break: break-word;
      text-align: left;
    }
    .thermal-receipt__meta {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      margin-top: 1.5mm;
      width: 100%;
    }
    .thermal-receipt__meta-col {
      min-width: 0;
      flex: 1 1 50%;
      font-size: 10px;
      font-weight: 700;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .thermal-receipt__meta-col--right { text-align: right; }
    .thermal-receipt__meta p { margin: 0 0 0.6mm; }
    .thermal-receipt__meta-label { font-weight: 900; }
    .thermal-receipt__table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11px;
      font-weight: 700;
    }
    .thermal-receipt__th-item,
    .thermal-receipt__item-name {
      width: 46%;
      text-align: left;
      padding-right: 1.5mm;
      overflow-wrap: anywhere;
      word-break: break-word;
      vertical-align: top;
    }
    .thermal-receipt__th-num,
    .thermal-receipt__num {
      width: 18%;
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      vertical-align: top;
      padding: 0.6mm 0;
    }
    .thermal-receipt__table th {
      padding: 0.6mm 0 1mm;
      font-weight: 900;
      border-bottom: 1px solid #000;
    }
    .thermal-receipt__table td {
      padding: 0.6mm 0;
      font-weight: 700;
    }
    .thermal-receipt__subtotal {
      font-size: 11px;
      font-weight: 900;
    }
    .thermal-receipt__grand-total {
      margin-top: 1.5mm;
      font-size: 13px;
      font-weight: 900;
    }
    .thermal-receipt__thanks {
      margin-top: 2.5mm;
      text-align: center;
      font-size: 12px;
      font-weight: 900;
    }
    @media print {
      html, body {
        width: 72mm;
        max-width: 72mm;
      }
      body { padding: 1mm 0 3mm; }
      .no-print-hint { display: none !important; }
      .thermal-receipt {
        border: none;
        max-width: 72mm;
        width: 72mm;
        padding: 1mm 2mm;
      }
    }
  </style>
</head>
<body>
  <p class="no-print-hint">Print dialog opens for your RP82 / 3″ thermal printer. Set paper to 80mm / 3″ receipt. Close this window when finished.</p>
  ${clone.outerHTML}
</body>
</html>`);
  win.document.close();

  const triggerPrint = () => {
    try {
      win.focus();
      // Opens the OS print UI (Windows / macOS). Window stays open afterward.
      win.print();
    } catch {
      // Window still stays open so the user can print manually (Cmd/Ctrl+P)
    }
  };

  const imgs = Array.from(win.document.images || []);
  if (!imgs.length) {
    win.setTimeout(triggerPrint, 250);
    return;
  }

  let left = imgs.length;
  let printed = false;
  const done = () => {
    left -= 1;
    if (left <= 0 && !printed) {
      printed = true;
      win.setTimeout(triggerPrint, 250);
    }
  };
  imgs.forEach((img) => {
    if (img.complete) done();
    else {
      img.onload = done;
      img.onerror = done;
    }
  });
  win.setTimeout(() => {
    if (!printed) {
      printed = true;
      triggerPrint();
    }
  }, 2500);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
