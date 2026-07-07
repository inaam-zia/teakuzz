import { Suspense } from "react";
import { getCafeName } from "@/lib/auth";
import MyOrdersClient from "./my-orders-client";

export default function MyOrdersPage() {
  return (
    <Suspense
      fallback={
        <main className="order-bg flex min-h-screen items-center justify-center px-5">
          <p className="text-cafe-500">Loading…</p>
        </main>
      }
    >
      <MyOrdersClient cafeName={getCafeName()} />
    </Suspense>
  );
}
