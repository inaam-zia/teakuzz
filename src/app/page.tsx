import Link from "next/link";
import { getCafeName } from "@/lib/auth";

export default function HomePage() {
  const cafeName = getCafeName();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="card w-full space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-cafe-500">
            Welcome to
          </p>
          <h1 className="mt-2 text-3xl font-bold text-cafe-900">{cafeName}</h1>
        </div>

        <p className="text-cafe-600">
          Scan the QR code on your table to browse the menu and place an order.
        </p>

        <div className="rounded-xl bg-cafe-100 px-4 py-3 text-sm text-cafe-700">
          No app needed — works in your phone browser.
        </div>

        <Link href="/admin/login" className="btn-secondary w-full">
          Admin login
        </Link>
      </div>
    </main>
  );
}
