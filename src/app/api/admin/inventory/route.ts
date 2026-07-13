import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listInventoryItems } from "@/lib/inventory";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const items = await listInventoryItems();
    // If empty, still check table exists by probing once
    if (!items.length) {
      const supabase = createServerClient();
      const { error } = await supabase.from("inventory_items").select("id").limit(1);
      if (error?.message.includes("inventory_items") || error?.message.includes("schema cache")) {
        return NextResponse.json(
          { error: "Run supabase/add-inventory.sql in Supabase SQL editor first.", setupRequired: true },
          { status: 503 }
        );
      }
    }
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const unit = String(body.unit || "pcs").trim() || "pcs";
    const quantity = Number(body.quantity);
    const lowStockThreshold = Number(body.low_stock_threshold);
    const notes = String(body.notes || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 });
    }
    if (!Number.isFinite(quantity)) {
      return NextResponse.json({ error: "Valid quantity is required" }, { status: 400 });
    }
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      return NextResponse.json(
        { error: "Low-stock threshold must be 0 or more" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        name,
        unit,
        quantity,
        low_stock_threshold: lowStockThreshold,
        notes,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes("inventory_items") || error.message.includes("schema cache")) {
        return NextResponse.json(
          { error: "Run supabase/add-inventory.sql in Supabase SQL editor first." },
          { status: 503 }
        );
      }
      if (error.message.includes("duplicate") || error.code === "23505") {
        return NextResponse.json(
          { error: "An inventory item with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({
      item: {
        ...data,
        quantity: Number(data.quantity),
        low_stock_threshold: Number(data.low_stock_threshold),
        notes: data.notes ?? "",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
