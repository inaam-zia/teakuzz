import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieConfig, verifyAdminPasswordAsync } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!(await verifyAdminPasswordAsync(String(password || "")))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const config = getAdminCookieConfig();
  cookies().set(config);

  return NextResponse.json({ ok: true });
}
