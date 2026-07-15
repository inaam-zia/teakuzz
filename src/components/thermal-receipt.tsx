import type { CafeBranding } from "@/lib/branding-types";
import { getReceiptConfig } from "@/lib/receipt-config";
import {
  calculateBillTotals,
  formatReceiptAmount,
  formatReceiptDate,
  formatReceiptGrandTotal,
  formatReceiptTime,
  getBillNumber,
} from "@/lib/receipt";
import type { OrderItem, OrderWithItems } from "@/lib/types";
import UpiPayPanel from "@/components/upi-pay-panel";

type Props = {
  order: OrderWithItems;
  customerName: string;
  branding: CafeBranding;
  paymentQrUrl?: string | null;
  paymentQrLabel?: string | null;
  paymentUpiId?: string | null;
  paymentPayeeName?: string | null;
};

export default function ThermalReceipt({
  order,
  customerName,
  branding,
  paymentQrUrl,
  paymentQrLabel,
  paymentUpiId,
  paymentPayeeName,
}: Props) {
  const receipt = getReceiptConfig(branding.appName);
  const billNumber = getBillNumber(order.id);
  const displayName = order.customer_name?.trim() || customerName.trim() || "Guest";
  const totalQty = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const subTotal = order.order_items.reduce(
    (sum, item) => sum + item.item_price * item.quantity,
    0
  );
  const bill = calculateBillTotals(subTotal, {
    gstEnabled: branding.gstEnabled,
    gstPercent: branding.gstPercent,
  });

  return (
    <article className="thermal-receipt" aria-label="Bill receipt">
      <header className="thermal-receipt__header">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt=""
            className="thermal-receipt__logo"
          />
        ) : null}
        <h2 className="thermal-receipt__brand">{receipt.cafeName}</h2>
        {receipt.addressLines.map((line) => (
          <p key={line} className="thermal-receipt__address">
            {line}
          </p>
        ))}
        {branding.gstEnabled && branding.gstin ? (
          <p className="thermal-receipt__gst">GSTIN: {branding.gstin}</p>
        ) : null}
      </header>

      <hr className="thermal-receipt__rule" />

      <div className="thermal-receipt__name-row">
        <span>Name:</span>
        <span className="thermal-receipt__name-value">{displayName}</span>
      </div>

      <div className="thermal-receipt__meta">
        <div className="thermal-receipt__meta-col">
          <p>
            <span className="thermal-receipt__meta-label">Date:</span>{" "}
            {formatReceiptDate(order.created_at)}
          </p>
          <p>
            <span className="thermal-receipt__meta-label">Time:</span>{" "}
            {formatReceiptTime(order.created_at)}
          </p>
          <p>
            <span className="thermal-receipt__meta-label">Cashier:</span> {receipt.cashier}
          </p>
        </div>
        <div className="thermal-receipt__meta-col thermal-receipt__meta-col--right">
          <p>
            <span className="thermal-receipt__meta-label">Dine In:</span>{" "}
            <strong>TB NO. {order.table_number}</strong>
          </p>
          <p>
            <span className="thermal-receipt__meta-label">Bill No.:</span> {billNumber}
          </p>
        </div>
      </div>

      <hr className="thermal-receipt__rule" />

      <table className="thermal-receipt__table">
        <thead>
          <tr>
            <th className="thermal-receipt__th-item">Item</th>
            <th className="thermal-receipt__th-num">Qty.</th>
            <th className="thermal-receipt__th-num">Price</th>
            <th className="thermal-receipt__th-num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.order_items.map((item) => (
            <ReceiptLine key={item.id} item={item} />
          ))}
        </tbody>
      </table>

      <hr className="thermal-receipt__rule" />

      <div className="thermal-receipt__subtotal">
        <span>Total Qty: {totalQty}</span>
        <span>Sub Total {formatReceiptAmount(bill.subTotal)}</span>
      </div>

      {bill.applyGst ? (
        <div className="thermal-receipt__gst-line">
          <span>
            GST @ {bill.gstPercent % 1 === 0 ? bill.gstPercent : bill.gstPercent.toFixed(2)}%
          </span>
          <span>{formatReceiptAmount(bill.gstAmount)}</span>
        </div>
      ) : null}

      <hr className="thermal-receipt__rule thermal-receipt__rule--thick" />

      <div className="thermal-receipt__grand-total">
        <span>Grand Total</span>
        <span>{formatReceiptGrandTotal(bill.grandTotal)}</span>
      </div>

      {paymentUpiId ? (
        <>
          <hr className="thermal-receipt__rule" />
          <UpiPayPanel
            upi={{
              upiId: paymentUpiId,
              payeeName: paymentPayeeName || receipt.cafeName,
              amount: bill.grandTotal,
              note: `Bill ${billNumber}`,
            }}
            fallbackQrUrl={paymentQrUrl}
            fallbackQrLabel={paymentQrLabel}
          />
        </>
      ) : paymentQrUrl ? (
        <>
          <hr className="thermal-receipt__rule" />
          <div className="thermal-receipt__pay">
            <p className="thermal-receipt__pay-title">Scan to pay</p>
            {paymentQrLabel ? (
              <p className="thermal-receipt__pay-label">{paymentQrLabel}</p>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={paymentQrUrl}
              alt="Payment QR code"
              className="thermal-receipt__pay-qr"
            />
            <p className="thermal-receipt__pay-amount">
              Pay {formatReceiptGrandTotal(bill.grandTotal)}
            </p>
          </div>
        </>
      ) : null}

      <hr className="thermal-receipt__rule" />

      <p className="thermal-receipt__thanks">Thanks</p>
    </article>
  );
}

function ReceiptLine({ item }: { item: OrderItem }) {
  const amount = item.item_price * item.quantity;

  return (
    <tr>
      <td className="thermal-receipt__item-name">{item.item_name}</td>
      <td className="thermal-receipt__num">{item.quantity}</td>
      <td className="thermal-receipt__num">{formatReceiptAmount(item.item_price)}</td>
      <td className="thermal-receipt__num">{formatReceiptAmount(amount)}</td>
    </tr>
  );
}
