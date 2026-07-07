import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  try {
    const envPath = join(root, ".env.local");
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local optional if vars already set
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const categories = [
  { name: "Noodles", sort_order: 1 },
  { name: "Pasta", sort_order: 2 },
  { name: "Burger", sort_order: 3 },
  { name: "Grilled Sandwiches", sort_order: 4 },
  { name: "Sub Sandwiches", sort_order: 5 },
  { name: "Wrap", sort_order: 6 },
  { name: "Fries", sort_order: 7 },
  { name: "Extra", sort_order: 8 },
  { name: "Add-ons", sort_order: 9 },
];

const items = [
  ["Noodles", "Maggi", "", 79],
  ["Noodles", "Yippee", "", 79],
  ["Noodles", "Wai Wai", "", 79],
  ["Pasta", "White Sauce Pasta", "", 149],
  ["Pasta", "Red Sauce Pasta", "", 149],
  ["Pasta", "Pink Sauce Pasta", "", 159],
  ["Burger", "Aloo Tikki Burger", "", 69],
  ["Burger", "Veg. Crispy Burger", "", 99],
  ["Burger", "Schezwan Burger", "", 89],
  ["Burger", "Achari Masti Burger", "", 99],
  ["Burger", "Peri-Peri Nachos Burger", "", 109],
  ["Burger", "Tandoori Paneer Burger", "", 119],
  ["Grilled Sandwiches", "Rainbow Sandwich", "", 109],
  ["Grilled Sandwiches", "Moms Kitchen Magic Sandwich", "Teakkuz Special", 119],
  ["Grilled Sandwiches", "Cheese Corn Sandwich", "", 129],
  ["Grilled Sandwiches", "Classic Paneer Sandwich", "", 139],
  ["Sub Sandwiches", "Garden Fresh", "Teakkuz Special", 139],
  ["Sub Sandwiches", "Schezwan Paneer Sub", "", 169],
  ["Wrap", "Aloo Tikki Wrap", "", 109],
  ["Wrap", "Veggie Delite Wrap", "", 99],
  ["Wrap", "Achari Paneer Wrap", "", 129],
  ["Wrap", "Paneer Wrap", "", 119],
  ["Fries", "Classic Salted Fries", "", 89],
  ["Fries", "Peri-Peri Fries", "", 99],
  ["Fries", "Chatkara Fries", "", 109],
  ["Fries", "Cheese Loaded Fries", "", 129],
  ["Fries", "Pizza Pocket", "", 119],
  ["Fries", "Cheese Corn", "", 109],
  ["Extra", "Bun Maska", "", 49],
  ["Extra", "Mix Salad Bowl", "", 89],
  ["Extra", "Sweet Corn", "", 119],
  ["Add-ons", "Dip", "Extra", 15],
  ["Add-ons", "Cheese Slice", "Extra", 20],
  ["Add-ons", "Honey", "Extra", 20],
  ["Add-ons", "Espresso Shot", "Extra", 69],
];

async function main() {
  console.log("Clearing existing menu…");
  await supabase.from("menu_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("menu_categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Inserting categories…");
  const { data: insertedCats, error: catError } = await supabase
    .from("menu_categories")
    .insert(categories)
    .select();

  if (catError) {
    console.error("Category error:", catError.message);
    process.exit(1);
  }

  const catMap = new Map(insertedCats.map((c) => [c.name, c.id]));

  const rows = items.map(([cat, name, description, price]) => ({
    category_id: catMap.get(cat),
    name,
    description,
    price,
    available: true,
  }));

  console.log(`Inserting ${rows.length} items…`);
  const { error: itemError } = await supabase.from("menu_items").insert(rows);

  if (itemError) {
    console.error("Item error:", itemError.message);
    process.exit(1);
  }

  console.log("Done! Teakkuzz menu loaded.");
}

main();
