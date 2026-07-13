"use client";

import { useRef, useState } from "react";
import { downloadCsv } from "@/lib/csv";

type BulkSummary = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
};

type Props = {
  title: string;
  description: string;
  endpoint: string;
  templateFilename: string;
  templateRows: (string | number)[][];
  /** Optional: export current data as CSV */
  exportFilename?: string;
  exportRows?: (string | number)[][];
  onComplete: (data: Record<string, unknown>) => void | Promise<void>;
};

export function BulkUploadPanel({
  title,
  description,
  endpoint,
  templateFilename,
  templateRows,
  exportFilename,
  exportRows,
  onComplete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [resultLines, setResultLines] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function readFile(file: File) {
    setError("");
    setSummary(null);
    setResultLines([]);
    if (!file.name.toLowerCase().endsWith(".csv") && file.type && !file.type.includes("csv") && !file.type.includes("text")) {
      setError("Please upload a .csv file (Excel → Save As → CSV).");
      return;
    }
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
  }

  async function upload() {
    if (!csvText.trim()) {
      setError("Choose a CSV file or paste CSV text first.");
      return;
    }
    setUploading(true);
    setError("");
    setSummary(null);
    setResultLines([]);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bulk upload failed");
        return;
      }

      const s = data.summary as BulkSummary;
      setSummary(s);

      const lines: string[] = [];
      for (const r of data.results ?? []) {
        if (r.status === "error") {
          lines.push(
            `✗ ${r.name || r.dish || "Row"}: ${r.message || "error"}`
          );
        } else if (r.status === "created" || r.status === "updated") {
          const label = r.name || r.dish;
          const extra =
            r.ingredients != null ? ` (${r.ingredients} ingredients)` : "";
          lines.push(`${r.status === "created" ? "+" : "~"} ${label}${extra}`);
        }
      }
      setResultLines(lines.slice(0, 40));
      await onComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk upload failed");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setCsvText("");
    setFileName("");
    setSummary(null);
    setResultLines([]);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-brand-heading">{title}</h3>
          <p className="text-sm text-brand-muted">{description}</p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide bulk upload" : "Bulk upload CSV"}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-brand/40 pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => downloadCsv(templateFilename, templateRows)}
            >
              Download template
            </button>
            {exportFilename && exportRows && exportRows.length > 1 && (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => downloadCsv(exportFilename, exportRows)}
              >
                Export current
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Upload .csv file
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-brand-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-heading file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
            />
            {fileName && (
              <p className="mt-1 text-xs text-brand-muted">Loaded: {fileName}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Or paste CSV
            </label>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setFileName("");
                setSummary(null);
              }}
              rows={6}
              className="input-field font-mono text-xs"
              placeholder="Paste CSV here…"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {summary && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              Done — {summary.created} created, {summary.updated} updated
              {summary.skipped ? `, ${summary.skipped} skipped` : ""}
              {summary.failed ? `, ${summary.failed} failed` : ""}.
            </div>
          )}

          {resultLines.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-brand bg-brand-surface px-3 py-2 font-mono text-xs text-brand-muted">
              {resultLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={uploading || !csvText.trim()}
              onClick={upload}
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button type="button" className="btn-secondary" onClick={reset}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
