/** Open a print window for a thermal receipt DOM node. */
export function printThermalBill(receiptEl: HTMLElement | null, title = "Bill") {
  if (!receiptEl || typeof window === "undefined") return;

  const win = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
  if (!win) {
    window.alert("Pop-up blocked. Allow pop-ups to print the bill.");
    return;
  }

  const clone = receiptEl.cloneNode(true) as HTMLElement;
  // Interactive pay UI is useless on paper
  clone.querySelectorAll(".thermal-receipt__pay").forEach((el) => el.remove());

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .thermal-receipt {
      margin: 0 auto;
      width: 100%;
      max-width: 20rem;
      border: 1px solid #d4d4d4;
      background: #fff;
      padding: 1.25rem 1rem;
      font-family: "Courier New", Courier, ui-monospace, monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
    }
    .thermal-receipt__header { text-align: center; }
    .thermal-receipt__logo {
      display: block;
      margin: 0 auto 8px;
      height: 48px;
      width: 48px;
      object-fit: contain;
    }
    .thermal-receipt__brand {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .thermal-receipt__address {
      margin: 0;
      font-size: 10px;
      line-height: 1.35;
    }
    .thermal-receipt__gst {
      margin: 4px 0 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .thermal-receipt__qty-line {
      margin-bottom: 4px;
      font-size: 10px;
    }
    .thermal-receipt__gst-line {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-top: 2px;
      font-size: 11px;
    }
    .thermal-receipt__rule {
      margin: 8px 0;
      border: 0;
      border-top: 1px dashed #a3a3a3;
    }
    .thermal-receipt__rule--thick {
      border-top: 2px solid #171717;
    }
    .thermal-receipt__name-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-weight: 600;
    }
    .thermal-receipt__meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 6px;
    }
    .thermal-receipt__meta-col--right { text-align: right; }
    .thermal-receipt__meta p { margin: 0 0 2px; }
    .thermal-receipt__meta-label { font-weight: 600; }
    .thermal-receipt__table {
      width: 100%;
      border-collapse: collapse;
    }
    .thermal-receipt__th-item { text-align: left; }
    .thermal-receipt__th-num,
    .thermal-receipt__num { text-align: right; }
    .thermal-receipt__table th,
    .thermal-receipt__table td {
      padding: 2px 0;
      vertical-align: top;
    }
    .thermal-receipt__item-name { text-align: left; padding-right: 6px; }
    .thermal-receipt__subtotal,
    .thermal-receipt__grand-total {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-weight: 700;
    }
    .thermal-receipt__grand-total {
      margin-top: 4px;
      font-size: 12px;
    }
    .thermal-receipt__thanks {
      margin-top: 8px;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
    }
    .no-print-hint {
      text-align: center;
      font: 12px system-ui, sans-serif;
      color: #737373;
      margin-bottom: 12px;
    }
    @media print {
      body { padding: 0; }
      .no-print-hint { display: none; }
      .thermal-receipt { border: none; max-width: none; box-shadow: none; }
    }
  </style>
</head>
<body>
  <p class="no-print-hint">Print dialog opening…</p>
  ${clone.outerHTML}
  <script>
    window.onload = function () {
      var imgs = Array.prototype.slice.call(document.images || []);
      if (!imgs.length) { window.focus(); window.print(); return; }
      var left = imgs.length;
      var done = function () {
        left -= 1;
        if (left <= 0) { window.focus(); window.print(); }
      };
      imgs.forEach(function (img) {
        if (img.complete) done();
        else { img.onload = done; img.onerror = done; }
      });
    };
  </script>
</body>
</html>`);
  win.document.close();
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
