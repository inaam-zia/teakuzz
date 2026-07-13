import { notFound } from "next/navigation";
import DeveloperCredit from "@/components/developer-credit";
import OrderClient from "./order-client";
import { getBranding } from "@/lib/branding";
import { listOffers } from "@/lib/offers";
import { isTableOrderable } from "@/lib/table-access";
import { getCafeTableByNumber, tableDisplayName } from "@/lib/tables";
import { getSavedCustomerForTable, validateTableAccess } from "@/lib/table-session";

export const dynamic = "force-dynamic";

type Props = {
  params: { tableNumber: string };
};

export default async function OrderPage({ params }: Props) {
  const tableNumber = parseInt(params.tableNumber, 10);

  if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
    notFound();
  }

  const cafeTable = await getCafeTableByNumber(tableNumber);
  const tableName = tableDisplayName(
    cafeTable ?? { table_number: tableNumber, label: null }
  );

  const access = await isTableOrderable(tableNumber);

  if (!access.ok && access.reason === "disabled") {
    return (
      <main className="order-bg flex min-h-screen flex-col items-center justify-center px-5">
        <div className="order-hero-card w-full max-w-lg text-center">
          <h1 className="text-2xl font-bold text-cafe-900">Table unavailable</h1>
          <p className="mt-2 text-cafe-600">
            {tableName} is currently disabled. Please ask staff for assistance.
          </p>
        </div>
        <DeveloperCredit className="mt-8" />
      </main>
    );
  }

  if (!access.ok && access.reason === "not_found") {
    return (
      <main className="order-bg flex min-h-screen flex-col items-center justify-center px-5">
        <div className="order-hero-card w-full max-w-lg text-center">
          <h1 className="text-2xl font-bold text-cafe-900">Invalid table</h1>
          <p className="mt-2 text-cafe-600">
            This QR code doesn&apos;t match an active table. Please scan the code on your table.
          </p>
        </div>
        <DeveloperCredit className="mt-8" />
      </main>
    );
  }

  const sessionCheck = await validateTableAccess(tableNumber);

  if (!sessionCheck.ok && sessionCheck.sessionsEnabled) {
    const message =
      sessionCheck.reason === "session_ended"
        ? "This table session has ended. Please scan the QR code on your table to start a new order."
        : "Please scan the QR code on your table to order. Typing the link won&apos;t work.";

    return (
      <main className="order-bg flex min-h-screen flex-col items-center justify-center px-5">
        <div className="order-hero-card w-full max-w-lg text-center">
          <p className="text-4xl">📱</p>
          <h1 className="mt-4 text-2xl font-bold text-cafe-900">Scan the table QR</h1>
          <p className="mt-2 text-cafe-600">{message}</p>
          <p className="mt-4 text-sm text-cafe-500">{tableName}</p>
        </div>
        <DeveloperCredit className="mt-8" />
      </main>
    );
  }

  const savedCustomer = await getSavedCustomerForTable(tableNumber);
  const branding = await getBranding();
  const initialOffers = await listOffers(true);

  return (
    <OrderClient
      tableNumber={tableNumber}
      tableName={tableName}
      branding={branding}
      savedCustomer={savedCustomer}
      initialOffers={initialOffers}
    />
  );
}
