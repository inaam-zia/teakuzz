import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  cookies().delete("cafe_admin_session");
  return NextResponse.json({ ok: true });
}
