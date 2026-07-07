import { NextResponse } from "next/server";
import { listOffers } from "@/lib/offers";

export async function GET() {
  const offers = await listOffers(true);
  return NextResponse.json({ offers });
}
