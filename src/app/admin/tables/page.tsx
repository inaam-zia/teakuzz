"use client";

import { useEffect, useState } from "react";
import TableHeading from "@/components/table-heading";
import { getScanUrl } from "@/lib/site-url";
import { formatTableRef, tableDisplayName } from "@/lib/tables";
import type { CafeTable } from "@/lib/types";

type EditForm = {
  name: string;
  notes: string;
  enabled: boolean;
};

export default function TablesPage() {
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrBump, setQrBump] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

    const payload: { name: string; tableNumber?: number } = {
      name: newName.trim(),
    };
    const num = parseInt(newNumber, 10);
    if (!isNaN(num)) payload.tableNumber = num;

    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setAdding(false);

    if (!res.ok) {
      setError(data.error || "Could not add table");
      return;
    }

    setNewName("");
    setNewNumber("");
    setSuccess(
      `“${formatTableRef(data.table_number, data.label)}” added. Print its QR code.`
    );
    await loadTables();
  }

  function startEdit(table: CafeTable) {
    setEditingId(table.id);
    setEditForm({
      name: table.label?.trim() || tableDisplayName(table),
      notes: table.notes || "",
      enabled: table.enabled,
    });
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editForm) return;

    const name = editForm.name.trim();
    if (!name) {
      setError("Table name is required");
      return;
    }

    const existing = tables.find((t) => t.id === editingId);
    const isRename =
      !!existing &&
      (existing.label || "").trim().toLowerCase() !== name.toLowerCase();

    if (isRename) {
      const ok = confirm(
        `Rename this table to “${name}”?\n\nThis will permanently delete all previous orders for this table, clear the guest session, and invalidate the old QR. You must print a new QR after.`
      );
      if (!ok) return;
    }

    setSavingEdit(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/tables/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          notes: editForm.notes,
          enabled: editForm.enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save table");
        return;
      }

      const savedId = editingId;
      setTables((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, ...data } : t))
      );
      setSuccess(
        data.message ||
          (data.reset
            ? `Renamed to “${name}”. Previous data deleted — print a new QR.`
            : "Table info saved.")
      );
      cancelEdit();
      if (data.reset) {
        setQrBump((n) => n + 1);
        setExpandedId(savedId);
      }
    } finally {
      setSavingEdit(false);
    }
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

    setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, ...data } : t)));
  }

  async function removeTable(table: CafeTable) {
    const title = tableDisplayName(table);
    if (
      !confirm(
        `Remove “${title}”? Its QR will stop working and order history for this table will be deleted.`
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");
    const res = await fetch(`/api/tables/${table.id}`, { method: "DELETE" });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not remove table");
      return;
    }

    if (expandedId === table.id) setExpandedId(null);
    if (editingId === table.id) cancelEdit();
    setSuccess(`“${title}” removed.`);
    await loadTables();
  }

  async function clearTableSession(table: CafeTable) {
    if (
      !confirm(
        `Mark “${tableDisplayName(table)}” as ready for new guests? Previous customers will need to scan the QR again and re-enter their details.`
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
        `Generate a new QR for “${tableDisplayName(table)}”?\n\nOld printed / saved QR codes for this table will stop working. Print or show the new QR after.`
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
          `New QR ready for “${tableDisplayName(table)}”. Print it to replace the old one.`
      );
    } finally {
      setBusyId(null);
    }
  }

  function escapeHtml(text: string) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function printQr(table: CafeTable) {
    const name = escapeHtml(tableDisplayName(table));
    const numberLine = `Table ${table.table_number}`;
    const scanUrl = getScanUrl(table.table_number, table.qr_token);
    const qrSrc = `/api/tables/qr?number=${table.table_number}&t=${Date.now()}&b=${qrBump}`;
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html><head><title>${name} QR</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #faf6f1; }
  .card { text-align: center; padding: 48px; border: 3px solid #5c3b2c; border-radius: 24px; background: white; max-width: 420px; }
  h1 { font-size: 40px; color: #5c3b2c; margin: 0 0 4px; word-break: break-word; }
  .num { color: #8a5639; margin: 0 0 8px; font-size: 16px; font-weight: 600; }
  .scan { color: #8a5639; margin: 0 0 20px; font-size: 18px; font-weight: 600; }
  img { width: 280px; height: 280px; }
  .url { margin-top: 16px; font-size: 12px; color: #aaa; word-break: break-all; max-width: 320px; }
  @media print { body { background: white; } }
</style></head>
<body>
  <div class="card">
    <h1>${name}</h1>
    <p class="num">${numberLine}</p>
    <p class="scan">Scan to place an order</p>
    <img src="${qrSrc}" alt="QR code" />
    <p class="url">${escapeHtml(scanUrl)}</p>
  </div>
  <script>
    window.onload = () => {
      const img = document.querySelector('img');
      if (img && !img.complete) {
        img.onload = () => window.print();
      } else {
        window.print();
      }
    };
  </script>
</body></html>`);
    win.document.close();
  }

  function printAllQrs() {
    const list = tables.filter((t) => t.enabled);
    if (!list.length) {
      setError("No active tables to print. Enable at least one table first.");
      return;
    }

    const stamp = Date.now();
    const cards = list
      .slice()
      .sort((a, b) =>
        tableDisplayName(a).localeCompare(tableDisplayName(b), undefined, {
          sensitivity: "base",
        })
      )
      .map((table) => {
        const name = escapeHtml(tableDisplayName(table));
        const scanUrl = getScanUrl(table.table_number, table.qr_token);
        const qrSrc = `/api/tables/qr?number=${table.table_number}&t=${stamp}&b=${qrBump}`;
        return `<div class="card">
  <h1>${name}</h1>
  <p class="num">Table ${table.table_number}</p>
  <p class="scan">Scan to place an order</p>
  <img src="${qrSrc}" alt="QR for ${name}" />
  <p class="url">${escapeHtml(scanUrl)}</p>
</div>`;
      })
      .join("\n");

    const win = window.open("", "_blank");
    if (!win) {
      setError("Pop-up blocked. Allow pop-ups to print all QR codes.");
      return;
    }

    win.document.write(`<!DOCTYPE html>
<html><head><title>All table QR codes</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #faf6f1; color: #5c3b2c; }
  .sheet-title { text-align: center; margin: 0 0 24px; font-size: 22px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .card {
    text-align: center;
    padding: 28px 20px;
    border: 3px solid #5c3b2c;
    border-radius: 20px;
    background: white;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  h1 { font-size: 28px; color: #5c3b2c; margin: 0 0 4px; word-break: break-word; }
  .num { color: #8a5639; margin: 0 0 6px; font-size: 14px; font-weight: 600; }
  .scan { color: #8a5639; margin: 0 0 12px; font-size: 15px; font-weight: 600; }
  img { width: 200px; height: 200px; }
  .url { margin-top: 10px; font-size: 10px; color: #aaa; word-break: break-all; }
  @media print {
    body { background: white; padding: 12px; }
    .sheet-title { display: none; }
    .grid { gap: 16px; }
  }
  @media (max-width: 700px) {
    .grid { grid-template-columns: 1fr; }
  }
</style></head>
<body>
  <h2 class="sheet-title">Table QR codes — Scan to place an order</h2>
  <div class="grid">
    ${cards}
  </div>
  <script>
    function readyToPrint() {
      const imgs = Array.from(document.images);
      if (!imgs.length) { window.print(); return; }
      let left = imgs.length;
      const done = () => { left -= 1; if (left <= 0) window.print(); };
      imgs.forEach((img) => {
        if (img.complete) done();
        else {
          img.onload = done;
          img.onerror = done;
        }
      });
    }
    window.onload = readyToPrint;
  </script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-cafe-900">Table QR codes</h2>
          <p className="text-cafe-600">
            Manage tables by name and number. The name is shown prominently; the number
          stays in QR links. Renaming a table deletes its previous orders and
          invalidates the old QR.
          </p>
        </div>
        {tables.length > 0 && (
          <button
            type="button"
            onClick={printAllQrs}
            className="btn-primary shrink-0"
            disabled={loading || !tables.some((t) => t.enabled)}
            title="Print QR codes for all active tables"
          >
            Print all QR codes
          </button>
        )}
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
        <div className="min-w-[160px] flex-1">
          <label htmlFor="new-table-name" className="mb-1 block text-sm font-medium text-cafe-700">
            Table name
          </label>
          <input
            id="new-table-name"
            type="text"
            placeholder="e.g. Patio, Window"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input-field"
            maxLength={80}
            required
          />
        </div>
        <div className="w-28">
          <label htmlFor="new-table-num" className="mb-1 block text-sm font-medium text-cafe-700">
            Number
          </label>
          <input
            id="new-table-num"
            type="number"
            min={1}
            max={99}
            placeholder="Auto"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            className="input-field"
          />
        </div>
        <button type="submit" disabled={adding || !newName.trim()} className="btn-primary">
          {adding ? "Adding…" : "Add table"}
        </button>
      </form>

      {loading ? (
        <p className="text-cafe-500">Loading tables…</p>
      ) : tables.length === 0 ? (
        <div className="card text-center text-cafe-500">
          No tables yet. Add one by name above.
        </div>
      ) : (
        <div className="space-y-3">
          {tables.map((table) => {
            const title = tableDisplayName(table);
            return (
              <div key={table.id} className="card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <TableHeading
                      tableNumber={table.table_number}
                      tableName={table.label}
                      size="lg"
                    />
                    <p className="mt-1 break-all text-sm text-cafe-500">
                      {getScanUrl(table.table_number, table.qr_token)}
                    </p>
                    {table.notes?.trim() && (
                      <p className="mt-1 text-sm text-cafe-500">{table.notes.trim()}</p>
                    )}
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
                      onClick={() =>
                        editingId === table.id ? cancelEdit() : startEdit(table)
                      }
                      className="btn-secondary text-sm"
                    >
                      {editingId === table.id ? "Cancel edit" : "Edit"}
                    </button>
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
                      New guests / clear
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

                {editingId === table.id && editForm && (
                  <form
                    onSubmit={saveEdit}
                    className="space-y-3 rounded-xl border border-cafe-200 bg-cafe-50/60 p-4"
                  >
                    <h3 className="font-semibold text-cafe-900">Edit table</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-cafe-700">
                          Table name
                        </label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="input-field"
                          maxLength={80}
                          required
                        />
                        <p className="mt-1 text-xs text-amber-800">
                          Changing the name deletes all previous orders for this table and
                          invalidates the old QR.
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-cafe-700">
                          Table number
                        </label>
                        <p className="input-field bg-cafe-50 text-cafe-700">
                          {tables.find((t) => t.id === editingId)?.table_number}
                        </p>
                        <p className="mt-1 text-xs text-cafe-500">
                          Fixed when the table is created — not editable.
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-cafe-700">
                          Notes (optional)
                        </label>
                        <input
                          value={editForm.notes}
                          onChange={(e) =>
                            setEditForm({ ...editForm, notes: e.target.value })
                          }
                          className="input-field"
                          placeholder="Staff notes — not shown to customers"
                          maxLength={500}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-cafe-700">
                        <input
                          type="checkbox"
                          checked={editForm.enabled}
                          onChange={(e) =>
                            setEditForm({ ...editForm, enabled: e.target.checked })
                          }
                        />
                        QR enabled (customers can order)
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" className="btn-primary" disabled={savingEdit}>
                        {savingEdit ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {expandedId === table.id && (
                  <div className="flex flex-col items-center rounded-xl border border-cafe-200 bg-cafe-50 p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={`${table.id}-${table.qr_token ?? "legacy"}-${qrBump}`}
                      src={`/api/tables/qr?number=${table.table_number}&b=${qrBump}&v=${encodeURIComponent(table.qr_token || "legacy")}`}
                      alt={`QR code for ${title}`}
                      className="h-48 w-48 rounded-lg bg-white p-2 shadow-sm"
                    />
                    <p className="mt-3 text-sm text-cafe-600">
                      Customers scan this to order from <strong>{title}</strong>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
