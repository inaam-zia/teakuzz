import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { listOffers } from "@/lib/offers";

export const dynamic = "force-dynamic";

export async function GET() {
  noStore();
  const offers = await listOffers(true);
  return NextResponse.json(
    { offers },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
