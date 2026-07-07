import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { categories, items, itemImagePath } from "./menu-items-data.mjs";

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
    image_url: itemImagePath(name),
    available: true,
  }));

  console.log(`Inserting ${rows.length} items…`);
  const { error: itemError } = await supabase.from("menu_items").insert(rows);

  if (itemError) {
    console.error("Item error:", itemError.message);
    process.exit(1);
  }

  console.log(`Done! Teakkuzz menu loaded (${rows.length} items, ${categories.length} categories).`);
}

main();
