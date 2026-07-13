import { createServerClient } from "@/lib/supabase";
import { restockForCancelledOrder } from "@/lib/inventory";
import type { CafeTable } from "@/lib/types";

/** Friendly name only (label), or null if unset. */
export function tableNameOnly(
  table: Pick<CafeTable, "label"> | { label?: string | null } | null | undefined
): string | null {
  const name = table?.label?.trim();
  return name || null;
}

/** Customer/admin facing title — prefers label, falls back to Table N. */
export function tableDisplayName(
  table: Pick<CafeTable, "table_number" | "label"> | null | undefined
): string {
  const name = tableNameOnly(table);
  if (name) return name;
  if (table?.table_number != null) return `Table ${table.table_number}`;
  return "Table";
}

/** Plain-text line: "Patio · Table 5" or "Table 5". */
export function formatTableRef(
  tableNumber: number,
  label?: string | null
): string {
  const name = label?.trim();
  if (name) return `${name} · Table ${tableNumber}`;
  return `Table ${tableNumber}`;
}

export async function getCafeTableByNumber(
  tableNumber: number
): Promise<CafeTable | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cafe_tables")
    .select("*")
    .eq("table_number", tableNumber)
    .maybeSingle();

  if (error || !data) return null;
  return data as CafeTable;
}

/** Map of table_number → label for enriching orders. */
export async function getTableLabelMap(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("cafe_tables")
      .select("table_number, label");
    for (const row of data ?? []) {
      const n = Number(row.table_number);
      const label = String(row.label || "").trim();
      if (Number.isFinite(n) && label) map.set(n, label);
    }
  } catch {
    /* ignore */
  }
  return map;
}

/**
 * Wipe all order history for a table and restock any logged inventory deductions.
 * Used when a table is renamed — previous identity/data is destroyed.
 */
export async function destroyTableData(tableNumber: number): Promise<void> {
  const supabase = createServerClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("table_number", tableNumber);

  for (const order of orders ?? []) {
    try {
      await restockForCancelledOrder(order.id);
    } catch {
      /* continue wipe even if restock fails */
    }
  }

  await supabase.from("orders").delete().eq("table_number", tableNumber);
}

export async function nextAvailableTableNumber(): Promise<number | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("cafe_tables")
    .select("table_number")
    .order("table_number");

  const used = new Set((data ?? []).map((r) => Number(r.table_number)));
  for (let n = 1; n <= 99; n++) {
    if (!used.has(n)) return n;
  }
  return null;
}
