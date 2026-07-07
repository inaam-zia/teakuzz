import { notFound } from "next/navigation";
import OrderClient from "./order-client";
import { getCafeName } from "@/lib/auth";
import { isTableOrderable } from "@/lib/table-access";

type Props = {
  params: { tableNumber: string };
};

export default async function OrderPage({ params }: Props) {
  const tableNumber = parseInt(params.tableNumber, 10);

  if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
    notFound();
  }

  const access = await isTableOrderable(tableNumber);

  if (!access.ok && access.reason === "disabled") {
    return (
      <main className="order-bg flex min-h-screen items-center justify-center px-5">
        <div className="order-hero-card w-full max-w-lg text-center">
          <h1 className="text-2xl font-bold text-cafe-900">Table unavailable</h1>
          <p className="mt-2 text-cafe-600">
            Table {tableNumber} is currently disabled. Please ask staff for assistance.
          </p>
        </div>
      </main>
    );
  }

  if (!access.ok && access.reason === "not_found") {
    return (
      <main className="order-bg flex min-h-screen items-center justify-center px-5">
        <div className="order-hero-card w-full max-w-lg text-center">
          <h1 className="text-2xl font-bold text-cafe-900">Invalid table</h1>
          <p className="mt-2 text-cafe-600">
            This QR code doesn&apos;t match an active table. Please scan the code on your table.
          </p>
        </div>
      </main>
    );
  }

  return <OrderClient tableNumber={tableNumber} cafeName={getCafeName()} />;
}
