"use client";

import { useEffect, useState } from "react";
import { getScanUrl } from "@/lib/site-url";
import type { CafeTable } from "@/lib/types";

export default function TablesPage() {
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newTableNumber, setNewTableNumber] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrBump, setQrBump] = useState(0);

  async function loadTables() {
    setError("");
    const res = await fetch("/api/tables");
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Could not load tables");
      setTables([]);
      return;
    }

    if (data.needsMigration) {
      setError(
        "Run supabase/add-cafe-tables.sql in your Supabase SQL editor to enable table management."
      );
      setTables([]);
      return;
    }

    setTables(data.tables || []);
  }

  useEffect(() => {
    loadTables().finally(() => setLoading(false));
  }, []);

  async function addTable(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber: parseInt(newTableNumber, 10) }),
    });

    const data = await res.json();
    setAdding(false);

    if (!res.ok) {
      setError(data.error || "Could not add table");
      return;
    }

    setNewTableNumber("");
    await loadTables();
  }

  async function toggleEnabled(table: CafeTable) {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/tables/${table.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !table.enabled }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not update table");
      return;
    }

    setTables((prev) => prev.map((t) => (t.id === table.id ? data : t)));
  }

  async function removeTable(table: CafeTable) {
    if (!confirm(`Remove Table ${table.table_number}? Its QR will stop working.`)) return;

    setError("");
    setSuccess("");
    const res = await fetch(`/api/tables/${table.id}`, { method: "DELETE" });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not remove table");
      return;
    }

    if (expandedId === table.id) setExpandedId(null);
    await loadTables();
  }

  async function clearTableSession(table: CafeTable) {
    if (
      !confirm(
        `Mark Table ${table.table_number} as ready for new guests? Previous customers will need to scan the QR again and re-enter their details.`
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");
    const res = await fetch(`/api/tables/${table.id}/clear-session`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Could not reset table");
      return;
    }

    setSuccess(data.message || "Table ready for new guests.");
    await loadTables();
  }

  async function regenerateQr(table: CafeTable) {
    if (
      !confirm(
        `Generate a new QR for Table ${table.table_number}?\n\nOld printed / saved QR codes for this table will stop working. Print or show the new QR after.`
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");
    setBusyId(table.id);

    try {
      const res = await fetch(`/api/tables/${table.id}/regenerate-qr`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not generate new QR");
        return;
      }

      if (data.table) {
        setTables((prev) =>
          prev.map((t) => (t.id === table.id ? { ...t, ...data.table } : t))
        );
      } else {
        await loadTables();
      }

      setQrBump((n) => n + 1);
      setExpandedId(table.id);
      setSuccess(
        data.message ||
          `New QR ready for Table ${table.table_number}. Print it to replace the old one.`
      );
    } finally {
      setBusyId(null);
    }
  }

  function printQr(table: CafeTable) {
    const scanUrl = getScanUrl(table.table_number, table.qr_token);
    const qrSrc = `/api/tables/qr?number=${table.table_number}&t=${Date.now()}&b=${qrBump}`;
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html><head><title>Table ${table.table_number} QR</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #faf6f1; }
  .card { text-align: center; padding: 48px; border: 3px solid #5c3b2c; border-radius: 24px; background: white; }
  h1 { font-size: 48px; color: #5c3b2c; margin: 0 0 8px; }
  p { color: #8a5639; margin: 0 0 24px; }
  img { width: 280px; height: 280px; }
  .url { margin-top: 16px; font-size: 12px; color: #aaa; word-break: break-all; max-width: 320px; }
  @media print { body { background: white; } }
</style></head>
<body>
  <div class="card">
    <h1>Table ${table.table_number}</h1>
    <p>Scan to order</p>
    <img src="${qrSrc}" alt="QR code" />
    <p class="url">${scanUrl}</p>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cafe-900">Table QR codes</h2>
        <p className="text-cafe-600">
          Add tables, print QR codes, and generate a new QR if an old print is lost or shared.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={addTable} className="card flex flex-wrap items-end gap-3">
        <div className="min-w-[140px] flex-1">
          <label htmlFor="new-table" className="mb-1 block text-sm font-medium text-cafe-700">
            Add table
          </label>
          <input
            id="new-table"
            type="number"
            min={1}
            max={99}
            placeholder="e.g. 8"
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            className="input-field"
            required
          />
        </div>
        <button type="submit" disabled={adding} className="btn-primary">
          {adding ? "Adding…" : "Add table"}
        </button>
      </form>

      {loading ? (
        <p className="text-cafe-500">Loading tables…</p>
      ) : tables.length === 0 ? (
        <div className="card text-center text-cafe-500">
          No tables yet. Add one above or run the database migration.
        </div>
      ) : (
        <div className="space-y-3">
          {tables.map((table) => (
            <div key={table.id} className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-cafe-900">Table {table.table_number}</p>
                  <p className="break-all text-sm text-cafe-500">
                    {getScanUrl(table.table_number, table.qr_token)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      table.enabled
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {table.enabled ? "Active" : "Disabled"}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleEnabled(table)}
                    className="btn-secondary text-sm"
                  >
                    {table.enabled ? "Disable QR" : "Enable QR"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expandedId === table.id ? null : table.id)
                    }
                    className="btn-secondary text-sm"
                  >
                    {expandedId === table.id ? "Hide QR" : "Show QR"}
                  </button>
                  <button
                    type="button"
                    onClick={() => clearTableSession(table)}
                    className="btn-secondary text-sm"
                  >
                    New guests
                  </button>
                  <button
                    type="button"
                    onClick={() => regenerateQr(table)}
                    disabled={busyId === table.id}
                    className="btn-secondary text-sm"
                  >
                    {busyId === table.id ? "Generating…" : "Generate new QR"}
                  </button>
                  <button
                    type="button"
                    onClick={() => printQr(table)}
                    className="btn-primary text-sm"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTable(table)}
                    className="text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {expandedId === table.id && (
                <div className="flex flex-col items-center rounded-xl border border-cafe-200 bg-cafe-50 p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`${table.id}-${table.qr_token ?? "legacy"}-${qrBump}`}
                    src={`/api/tables/qr?number=${table.table_number}&b=${qrBump}&v=${encodeURIComponent(table.qr_token || "legacy")}`}
                    alt={`QR code for table ${table.table_number}`}
                    className="h-48 w-48 rounded-lg bg-white p-2 shadow-sm"
                  />
                  <p className="mt-3 text-sm text-cafe-600">
                    Customers scan this to open the menu for Table {table.table_number}
                  </p>
                  <button
                    type="button"
                    onClick={() => printQr(table)}
                    className="btn-primary mt-3 text-sm"
                  >
                    Print this QR
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
