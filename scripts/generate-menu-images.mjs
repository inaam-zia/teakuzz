/**
 * Generate per-item menu photos via Pollinations (flux) and save to public/menu/items/.
 * Skips files that already exist unless --force is passed.
 *
 * Usage: node scripts/generate-menu-images.mjs [--force] [--only=slug1,slug2]
 */
import { existsSync } from "fs";
import { mkdir, writeFile, access, copyFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { enrichedItems } from "./menu-items-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "menu", "items");
const WIDTH = 768;
const HEIGHT = 768;
const CONCURRENCY = 1;
const DELAY_MS = 12000;
const MAX_RETRIES = 5;
const RATE_LIMIT_WAIT_MS = 90000;

const force = process.argv.includes("--force");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlySlugs = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim()))
  : null;

const categoryFile = {
  "Cold Coffee": "cold-coffee.jpg",
  "Coffee / Hot": "hot-coffee.jpg",
  Tea: "tea.jpg",
  Shakes: "shakes.jpg",
  Coolers: "coolers.jpg",
  Noodles: "noodles.jpg",
  Pasta: "pasta.jpg",
  Burger: "burger.jpg",
  "Grilled Sandwiches": "grilled-sandwiches.jpg",
  "Sub Sandwiches": "sub-sandwiches.jpg",
  Wrap: "wrap.jpg",
  Fries: "fries.jpg",
  Extra: "extra.jpg",
  "Add-ons": "add-ons.jpg",
};

const CATEGORIES_DIR = join(__dirname, "..", "public", "menu", "categories");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function imageUrl(prompt, seed) {
  const params = new URLSearchParams({
    width: String(WIDTH),
    height: String(HEIGHT),
    model: "flux",
    nologo: "true",
    seed: String(seed),
    enhance: "true",
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(prompt, seed) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = imageUrl(prompt, seed + attempt);
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const type = res.headers.get("content-type") || "";
      if (!type.startsWith("image/")) {
        throw new Error(`Unexpected content-type: ${type}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 8000) {
        throw new Error(`Image too small (${buf.length} bytes)`);
      }
      return buf;
    } catch (err) {
      lastError = err;
      const is429 = String(err.message).includes("429");
      const wait = is429 ? RATE_LIMIT_WAIT_MS : 4000 * attempt;
      if (is429) {
        console.warn(`    rate limited, waiting ${wait / 1000}s…`);
      }
      await sleep(wait);
    }
  }
  throw lastError;
}

async function copyCategoryFallback(item) {
  const catFile = categoryFile[item.category];
  if (!catFile) return false;
  const src = join(CATEGORIES_DIR, catFile);
  const dest = join(OUT_DIR, `${item.slug}.jpg`);
  try {
    await copyFile(src, dest);
    return true;
  } catch {
    return false;
  }
}

async function processItem(item, index) {
  const outPath = join(OUT_DIR, `${item.slug}.jpg`);

  if (!force && (await exists(outPath))) {
    return { item, status: "skipped" };
  }

  const seed = 42000 + index * 17;
  const buf = await downloadImage(item.prompt, seed);
  await writeFile(outPath, buf);
  return { item, status: "ok" };
}

async function runPool(queue, worker) {
  const results = [];
  let i = 0;

  async function workerLoop() {
    while (i < queue.length) {
      const idx = i++;
      const item = queue[idx];
      try {
        const result = await worker(item, idx);
        results.push(result);
        console.log(`  [${idx + 1}/${queue.length}] ${result.status === "ok" ? "✓" : "–"} ${item.name}`);
      } catch (err) {
        results.push({ item, status: "failed", error: err.message });
        console.error(`  [${idx + 1}/${queue.length}] ✗ ${item.name}: ${err.message}`);
      }
      if (idx < queue.length - 1) {
        await sleep(DELAY_MS);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => workerLoop())
  );
  return results;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let list = enrichedItems();
  if (onlySlugs) {
    list = list.filter((item) => onlySlugs.has(item.slug));
  }

  console.log(`Generating ${list.length} menu item images → public/menu/items/`);
  console.log(`Size: ${WIDTH}x${HEIGHT}, concurrency: ${CONCURRENCY}\n`);

  const results = await runPool(list, processItem);

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed");

  console.log(`\nDone: ${ok} generated, ${skipped} skipped, ${failed.length} failed.`);

  if (failed.length) {
    console.log("\nUsing category image fallback for failed items…");
    for (const f of failed) {
      const ok = await copyCategoryFallback(f.item);
      console.log(`  ${ok ? "fallback ✓" : "fallback ✗"} ${f.item.name}`);
    }

    const stillMissing = list.filter(
      (item) => !existsSync(join(OUT_DIR, `${item.slug}.jpg`))
    );
    if (stillMissing.length) {
      console.log("\nStill missing images:");
      for (const item of stillMissing) {
        console.log(`  ${item.slug}`);
      }
      process.exit(1);
    }
    console.log("\nAll items have images (some via category fallback).");
  }
}

main();
