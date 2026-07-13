import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listInventoryItems } from "@/lib/inventory";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { normalizeHeaderKey, parseCsv, rowsToObjects } from "@/lib/csv";

type BulkRowResult = {
  row: number;
  name: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
};

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const csvText = String(body.csv || "").trim();
    if (!csvText) {
      return NextResponse.json({ error: "CSV content is required" }, { status: 400 });
    }

    const objects = rowsToObjects(parseCsv(csvText));
    if (!objects.length) {
      return NextResponse.json(
        { error: "No data rows found. Include a header row and at least one item." },
        { status: 400 }
      );
    }

    if (objects.length > 500) {
      return NextResponse.json(
        { error: "Too many rows (max 500). Split into smaller files." },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const existing = await listInventoryItems();
    const byName = new Map(
      existing.map((i) => [i.name.trim().toLowerCase(), i])
    );

    const results: BulkRowResult[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < objects.length; i++) {
      const rowNum = i + 2; // header is row 1
      const obj = objects[i];
      const name = normalizeHeaderKey(obj, ["name", "item", "item_name", "ingredient"]).trim();
      const unit =
        normalizeHeaderKey(obj, ["unit", "units"]).trim() || "pcs";
      const quantityRaw = normalizeHeaderKey(obj, [
        "quantity",
        "qty",
        "stock",
        "current_quantity",
      ]);
      const thresholdRaw = normalizeHeaderKey(obj, [
        "low_stock_threshold",
        "threshold",
        "low_stock",
        "reorder_at",
        "warn_at",
      ]);
      const notes = normalizeHeaderKey(obj, ["notes", "note", "comment"]).trim();

      if (!name) {
        results.push({
          row: rowNum,
          name: "",
          status: "error",
          message: "Missing name",
        });
        failed++;
        continue;
      }

      const quantity = quantityRaw === "" ? 0 : Number(quantityRaw);
      const lowStockThreshold =
        thresholdRaw === "" ? 0 : Number(thresholdRaw);

      if (!Number.isFinite(quantity)) {
        results.push({
          row: rowNum,
          name,
          status: "error",
          message: "Invalid quantity",
        });
        failed++;
        continue;
      }
      if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
        results.push({
          row: rowNum,
          name,
          status: "error",
          message: "Invalid low_stock_threshold",
        });
        failed++;
        continue;
      }

      const key = name.toLowerCase();
      const found = byName.get(key);

      if (found) {
        const { data, error } = await supabase
          .from("inventory_items")
          .update({
            unit,
            quantity,
            low_stock_threshold: lowStockThreshold,
            notes,
            updated_at: now,
          })
          .eq("id", found.id)
          .select()
          .single();

        if (error || !data) {
          results.push({
            row: rowNum,
            name,
            status: "error",
            message: error?.message || "Update failed",
          });
          failed++;
          continue;
        }

        byName.set(key, {
          ...found,
          unit,
          quantity,
          low_stock_threshold: lowStockThreshold,
          notes,
        });
        results.push({ row: rowNum, name, status: "updated" });
        updated++;
      } else {
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

        if (error || !data) {
          results.push({
            row: rowNum,
            name,
            status: "error",
            message: error?.message || "Insert failed",
          });
          failed++;
          continue;
        }

        byName.set(key, {
          id: data.id,
          name: data.name,
          unit: data.unit,
          quantity: Number(data.quantity),
          low_stock_threshold: Number(data.low_stock_threshold),
          notes: data.notes ?? "",
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
        results.push({ row: rowNum, name, status: "created" });
        created++;
      }
    }

    const items = await listInventoryItems();
    return NextResponse.json({
      summary: { created, updated, skipped, failed, total: objects.length },
      results,
      items,
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
