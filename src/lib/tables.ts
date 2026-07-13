import { createServerClient } from "@/lib/supabase";
import { restockForCancelledOrder } from "@/lib/inventory";
import type { CafeTable } from "@/lib/types";

/** Customer/admin facing title for a table. */
export function tableDisplayName(
  table: Pick<CafeTable, "table_number" | "label"> | null | undefined
): string {
  const name = table?.label?.trim();
  if (name) return name;
  if (table?.table_number != null) return `Table ${table.table_number}`;
  return "Table";
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

  // order_items / dish_feedback / inventory_deductions cascade from orders
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
