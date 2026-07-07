import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getTableAccessCookieConfig,
  getTableAccessFromCookie,
  getTableCustomerFromCookie,
  getTableCustomerLogoutCookieConfig,
  getTableSessionFromDb,
} from "@/lib/table-session";
import { isTableOrderable } from "@/lib/table-access";

type RouteContext = { params: { tableNumber: string } };

export async function GET(request: Request, { params }: RouteContext) {
  const tableNumber = parseInt(params.tableNumber, 10);
  const origin = new URL(request.url).origin;

  if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
    return NextResponse.redirect(new URL("/", origin));
  }

  const access = await isTableOrderable(tableNumber);
  if (!access.ok) {
    return NextResponse.redirect(new URL(`/order/${tableNumber}?blocked=1`, origin));
  }

  const dbSession = await getTableSessionFromDb(tableNumber);

  if (dbSession?.sessionId) {
    const customer = getTableCustomerFromCookie();
    const previousAccess = getTableAccessFromCookie();

    cookies().set(getTableAccessCookieConfig(tableNumber, dbSession.sessionId));

    const sessionChanged =
      previousAccess?.sessionId !== dbSession.sessionId ||
      previousAccess?.tableNumber !== tableNumber;

    if (customer && (sessionChanged || customer.sessionId !== dbSession.sessionId)) {
      cookies().set(getTableCustomerLogoutCookieConfig());
    }
  }

  return NextResponse.redirect(new URL(`/order/${tableNumber}`, origin));
}
