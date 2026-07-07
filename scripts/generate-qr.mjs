import QRCode from "qrcode";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "https://teakuzz.vercel.app";

const outDir = join(root, "public", "qr");
mkdirSync(outDir, { recursive: true });

function parseTables(args) {
  const input = args[2];

  if (!input) {
    return [Math.floor(Math.random() * 10) + 1];
  }

  if (input.includes("-")) {
    const [start, end] = input.split("-").map(Number);
    if (isNaN(start) || isNaN(end) || start > end) {
      throw new Error("Invalid range. Use e.g. 1-7");
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  const n = parseInt(input, 10);
  if (isNaN(n)) throw new Error("Invalid table number");
  return [n];
}

async function generateTable(tableNumber) {
  const scanUrl = `${baseUrl.replace(/\/$/, "")}/scan/${tableNumber}`;
  const pngPath = join(outDir, `table-${tableNumber}.png`);
  const htmlPath = join(outDir, `table-${tableNumber}-print.html`);

  await QRCode.toFile(pngPath, scanUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#5c3b2c", light: "#ffffff" },
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Table ${tableNumber} QR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #faf6f1;
    }
    .card {
      text-align: center;
      padding: 48px;
      border: 3px solid #5c3b2c;
      border-radius: 24px;
      background: white;
    }
    h1 { font-size: 48px; color: #5c3b2c; margin-bottom: 8px; }
    p { color: #8a5639; margin-bottom: 24px; font-size: 18px; }
    img { width: 280px; height: 280px; }
    .url { margin-top: 20px; font-size: 12px; color: #aaa; word-break: break-all; max-width: 320px; }
    @media print {
      body { background: white; }
      .card { border: 2px solid #000; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Table ${tableNumber}</h1>
    <p>Scan to order</p>
    <img src="./table-${tableNumber}.png" alt="QR code for table ${tableNumber}" />
    <p class="url">${scanUrl}</p>
  </div>
</body>
</html>`;

  writeFileSync(htmlPath, html);

  return { tableNumber, scanUrl, pngPath, htmlPath };
}

const tables = parseTables(process.argv);
const results = [];

for (const table of tables) {
  results.push(await generateTable(table));
}

if (tables.length > 1) {
  const allPrintHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Tables ${tables[0]}-${tables[tables.length - 1]} QR Codes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #faf6f1; padding: 24px; }
    h1 { text-align: center; color: #5c3b2c; margin-bottom: 24px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .card {
      text-align: center;
      padding: 32px 24px;
      border: 3px solid #5c3b2c;
      border-radius: 20px;
      background: white;
      page-break-inside: avoid;
    }
    .card h2 { font-size: 36px; color: #5c3b2c; margin-bottom: 8px; }
    .card p { color: #8a5639; margin-bottom: 16px; }
    .card img { width: 200px; height: 200px; }
    @media print {
      body { background: white; padding: 0; }
      .grid { display: block; }
      .card {
        border: 2px solid #000;
        margin-bottom: 40px;
        break-after: page;
      }
      .card:last-child { break-after: auto; }
    }
  </style>
</head>
<body>
  <h1>Teakuzz Cafe — Scan to Order</h1>
  <div class="grid">
    ${results
      .map(
        (r) => `<div class="card">
      <h2>Table ${r.tableNumber}</h2>
      <p>Scan to order</p>
      <img src="./table-${r.tableNumber}.png" alt="Table ${r.tableNumber}" />
    </div>`
      )
      .join("\n")}
  </div>
</body>
</html>`;

  const allPath = join(outDir, `tables-${tables[0]}-${tables[tables.length - 1]}-print.html`);
  writeFileSync(allPath, allPrintHtml);
  console.log(`\nCombined print page: ${allPath}`);
}

console.log(JSON.stringify(results, null, 2));
