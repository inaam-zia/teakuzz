import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { categories, items, itemImagePath } from "./menu-items-data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function esc(s) {
  return s.replace(/'/g, "''");
}

const lines = [
  "-- Teakkuzz Cafe menu — run in Supabase SQL Editor to replace the sample menu",
  "-- Safe: order_items store item names, not menu_item IDs",
  "",
  "delete from menu_items;",
  "delete from menu_categories;",
  "",
  "insert into menu_categories (name, sort_order) values",
  categories
    .map((c, i) => `  ('${esc(c.name)}', ${c.sort_order})${i < categories.length - 1 ? "," : ";"}`)
    .join("\n"),
  "",
  "insert into menu_items (category_id, name, description, price, image_url)",
  "select c.id, v.name, v.description, v.price, v.image_url",
  "from (values",
  items
    .map(([cat, name, desc, price], i) => {
      const img = itemImagePath(name);
      return `  ('${esc(cat)}', '${esc(name)}', '${esc(desc)}', ${price}, '${img}')${i < items.length - 1 ? "," : ""}`;
    })
    .join("\n"),
  ") as v(cat, name, description, price, image_url)",
  "join menu_categories c on c.name = v.cat;",
  "",
];

writeFileSync(join(root, "supabase", "seed-teakkuz-menu.sql"), lines.join("\n"));
console.log("Wrote supabase/seed-teakkuz-menu.sql");
