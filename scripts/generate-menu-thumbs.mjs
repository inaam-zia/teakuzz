/**
 * Create 240px thumbnails for fast menu loading.
 * Usage: node scripts/generate-menu-thumbs.mjs
 */
import { mkdir, readdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "public", "menu", "items");
const thumbDir = join(srcDir, "thumbs");

await mkdir(thumbDir, { recursive: true });

const files = (await readdir(srcDir)).filter((f) => f.endsWith(".jpg"));
let count = 0;

for (const file of files) {
  const input = join(srcDir, file);
  const output = join(thumbDir, file);
  execSync(`sips -Z 240 "${input}" --out "${output}"`, { stdio: "pipe" });
  count++;
}

console.log(`Created ${count} thumbnails in public/menu/items/thumbs/`);
