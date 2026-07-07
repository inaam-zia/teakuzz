import { existsSync } from "fs";
import { join } from "path";
import { enrichedItems } from "./menu-items-data.mjs";

const dir = join("public", "menu", "items");
const missing = enrichedItems().filter((i) => !existsSync(join(dir, `${i.slug}.jpg`)));
console.log(`${missing.length} missing`);
for (const item of missing) {
  console.log(item.slug);
}
