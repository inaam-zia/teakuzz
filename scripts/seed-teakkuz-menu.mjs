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

const categoryImages = {
  "Cold Coffee": "/menu/categories/cold-coffee.jpg",
  "Coffee / Hot": "/menu/categories/hot-coffee.jpg",
  Tea: "/menu/categories/tea.jpg",
  Shakes: "/menu/categories/shakes.jpg",
  Coolers: "/menu/categories/coolers.jpg",
  Noodles: "/menu/categories/noodles.jpg",
  Pasta: "/menu/categories/pasta.jpg",
  Burger: "/menu/categories/burger.jpg",
  "Grilled Sandwiches": "/menu/categories/grilled-sandwiches.jpg",
  "Sub Sandwiches": "/menu/categories/sub-sandwiches.jpg",
  Wrap: "/menu/categories/wrap.jpg",
  Fries: "/menu/categories/fries.jpg",
  Extra: "/menu/categories/extra.jpg",
  "Add-ons": "/menu/categories/add-ons.jpg",
};

const categories = [
  { name: "Cold Coffee", sort_order: 1 },
  { name: "Coffee / Hot", sort_order: 2 },
  { name: "Tea", sort_order: 3 },
  { name: "Shakes", sort_order: 4 },
  { name: "Coolers", sort_order: 5 },
  { name: "Noodles", sort_order: 6 },
  { name: "Pasta", sort_order: 7 },
  { name: "Burger", sort_order: 8 },
  { name: "Grilled Sandwiches", sort_order: 9 },
  { name: "Sub Sandwiches", sort_order: 10 },
  { name: "Wrap", sort_order: 11 },
  { name: "Fries", sort_order: 12 },
  { name: "Extra", sort_order: 13 },
  { name: "Add-ons", sort_order: 14 },
];

const items = [
  // Cold Coffee
  ["Cold Coffee", "Classic Cold Coffee", "", 89],
  ["Cold Coffee", "Iced Americano", "", 99],
  ["Cold Coffee", "Iced Mocha", "", 109],
  ["Cold Coffee", "Caramel", "", 129],
  ["Cold Coffee", "Tiramisu", "", 139],
  ["Cold Coffee", "Hazelnut", "", 149],
  ["Cold Coffee", "Premium Cold Coffee", "", 149],
  ["Cold Coffee", "Vietnamese Cold Coffee", "", 149],

  // Coffee / Hot
  ["Coffee / Hot", "Cappuccino", "", 99],
  ["Coffee / Hot", "Espresso", "", 99],
  ["Coffee / Hot", "Americano", "", 99],
  ["Coffee / Hot", "Coffee Latte", "", 119],
  ["Coffee / Hot", "Hot Chocolate", "", 149],

  // Tea
  ["Tea", "Kadak Chai", "", 29],
  ["Tea", "Masala Chai", "", 30],
  ["Tea", "Adarak Elaichi Chai", "", 30],
  ["Tea", "Gud Wali Chai", "", 36],
  ["Tea", "Haldi Chai", "", 36],
  ["Tea", "Green Tea", "", 29],
  ["Tea", "Green Tea with Honey", "", 39],
  ["Tea", "Honey Ginger Lemon Tea", "", 39],

  // Shakes
  ["Shakes", "Korean Banana", "", 89],
  ["Shakes", "Alphonso Mango", "", 99],
  ["Shakes", "Oreo Shake", "", 119],
  ["Shakes", "Kit-Kat Shake", "", 129],
  ["Shakes", "Strawberry Love", "", 129],
  ["Shakes", "Mixed Berry", "", 139],

  // Coolers
  ["Coolers", "Mint Mojito", "", 99],
  ["Coolers", "Spicy Lemonade", "", 99],
  ["Coolers", "Watermelon", "", 99],
  ["Coolers", "Spicy Mango (Aam Panna)", "", 99],
  ["Coolers", "Chilli Guava", "", 99],
  ["Coolers", "Green Apple", "", 99],
  ["Coolers", "Passion Fruit", "", 99],
  ["Coolers", "Blueberry", "", 99],
  ["Coolers", "Peach", "", 99],
  ["Coolers", "Iced Tea", "", 99],
  ["Coolers", "Blue Lagoon", "", 99],
  ["Coolers", "Peach Iced Tea", "", 99],

  // Noodles
  ["Noodles", "Maggi", "", 79],
  ["Noodles", "Yippee", "", 79],
  ["Noodles", "Wai Wai", "", 79],

  // Pasta
  ["Pasta", "White Sauce Pasta", "", 149],
  ["Pasta", "Red Sauce Pasta", "", 149],
  ["Pasta", "Pink Sauce Pasta", "", 159],

  // Burger
  ["Burger", "Aloo Tikki Burger", "", 69],
  ["Burger", "Veg Crispy Burger", "", 99],
  ["Burger", "Schezwan Burger", "", 89],
  ["Burger", "Achari Masti Burger", "", 99],
  ["Burger", "Peri-Peri Nachos Burger", "", 109],
  ["Burger", "Tandoori Paneer Burger", "", 119],

  // Grilled Sandwiches
  ["Grilled Sandwiches", "Rainbow Sandwich", "", 109],
  ["Grilled Sandwiches", "Moms Kitchen Magic Sandwich", "Teakkuz Special", 119],
  ["Grilled Sandwiches", "Cheese Corn Sandwich", "", 129],
  ["Grilled Sandwiches", "Classic Paneer Sandwich", "", 139],

  // Sub Sandwiches
  ["Sub Sandwiches", "Garden Fresh", "Teakkuz Special", 139],
  ["Sub Sandwiches", "Schezwan Paneer Sub", "", 169],

  // Wrap
  ["Wrap", "Aloo Tikki Wrap", "", 109],
  ["Wrap", "Veggie Delite Wrap", "", 99],
  ["Wrap", "Achari Paneer Wrap", "", 129],
  ["Wrap", "Paneer Wrap", "", 119],

  // Fries
  ["Fries", "Classic Salted Fries", "", 89],
  ["Fries", "Peri-Peri Fries", "", 99],
  ["Fries", "Chatkara Fries", "", 109],
  ["Fries", "Cheese Loaded Fries", "", 129],
  ["Fries", "Pizza Pocket", "", 119],
  ["Fries", "Cheese Corn", "", 109],

  // Extra
  ["Extra", "Bun Maska", "", 49],
  ["Extra", "Mix Salad Bowl", "", 89],
  ["Extra", "Sweet Corn", "", 119],

  // Add-ons
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
    image_url: categoryImages[cat],
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
