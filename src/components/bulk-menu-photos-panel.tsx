"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LazyMenuImage from "@/components/lazy-menu-image";
import type { MenuItem } from "@/lib/types";

type Props = {
  items: MenuItem[];
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  uploadImage: (file: File) => Promise<string>;
};

type QueueRow = {
  id: string;
  itemId: string;
  file: File;
  previewUrl: string;
};

export default function BulkMenuPhotosPanel({
  items,
  open,
  onClose,
  onComplete,
  uploadImage,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState("");
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const queuedItemIds = useMemo(
    () => new Set(queue.map((r) => r.itemId)),
    [queue]
  );

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return sortedItems.filter((i) => {
      if (queuedItemIds.has(i.id)) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q);
    });
  }, [sortedItems, itemSearch, queuedItemIds]);

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;

  useEffect(() => {
    if (selectedItemId && queuedItemIds.has(selectedItemId)) {
      setSelectedItemId("");
    }
  }, [selectedItemId, queuedItemIds]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  function revokeQueue(list: QueueRow[]) {
    for (const row of list) URL.revokeObjectURL(row.previewUrl);
  }

  function clearPendingPhoto() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetForm() {
    setSelectedItemId("");
    setItemSearch("");
    clearPendingPhoto();
  }

  function handleClose() {
    if (busy) return;
    revokeQueue(queue);
    setQueue([]);
    resetForm();
    setError("");
    setSummary(null);
    setProgress("");
    onClose();
  }

  function onPickPhoto(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      clearPendingPhoto();
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Use a JPG, PNG, WebP, or GIF image.");
      return;
    }
    setError("");
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  }

  function addToQueue() {
    if (!selectedItemId) {
      setError("Select a menu item first.");
      return;
    }
    if (!pendingFile || !pendingPreview) {
      setError("Choose a new photo for this item.");
      return;
    }

    const row: QueueRow = {
      id: `${selectedItemId}-${Date.now()}`,
      itemId: selectedItemId,
      file: pendingFile,
      previewUrl: pendingPreview,
    };

    setQueue((prev) => {
      const withoutDup = prev.filter((r) => {
        if (r.itemId !== selectedItemId) return true;
        URL.revokeObjectURL(r.previewUrl);
        return false;
      });
      return [...withoutDup, row];
    });

    // Transfer ownership of preview URL to queue — don't revoke
    setPendingFile(null);
    setPendingPreview("");
    if (fileRef.current) fileRef.current.value = "";
    setSelectedItemId("");
    setItemSearch("");
    setError("");
    setSummary(null);
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.id !== id);
    });
  }

  async function applyQueue() {
    if (!queue.length) {
      setError("Add at least one item with a new photo.");
      return;
    }

    setBusy(true);
    setError("");
    setSummary(null);

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < queue.length; i++) {
      const row = queue[i];
      const item = items.find((it) => it.id === row.itemId);
      setProgress(`Saving ${i + 1} of ${queue.length}…`);
      try {
        const imageUrl = await uploadImage(row.file);
        const res = await fetch(`/api/menu/${row.itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: imageUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          failed += 1;
          setError(
            (prev) =>
              `${prev ? `${prev}\n` : ""}${item?.name || row.itemId}: ${
                data.error || "failed"
              }`
          );
          continue;
        }
        updated += 1;
      } catch (err) {
        failed += 1;
        setError(
          (prev) =>
            `${prev ? `${prev}\n` : ""}${item?.name || row.itemId}: ${
              err instanceof Error ? err.message : "failed"
            }`
        );
      }
    }

    setBusy(false);
    setProgress("");
    revokeQueue(queue);
    setQueue([]);
    setSummary(
      `Updated ${updated} photo${updated === 1 ? "" : "s"}${
        failed ? `, ${failed} failed` : ""
      }.`
    );
    onComplete();
    if (!failed) {
      // Brief success then close
      setTimeout(() => {
        resetForm();
        setSummary(null);
        onClose();
      }, 900);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="bulk-photo-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) handleClose();
      }}
    >
      <div
        className="bulk-photo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-photo-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="bulk-photo-modal-title" className="text-lg font-bold text-cafe-900">
              Bulk change photos
            </h3>
            <p className="mt-1 text-sm text-cafe-600">
              Select a menu item by name, add a new photo, then add more items or save.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-sm text-cafe-500 hover:bg-cafe-50 hover:text-cafe-800 disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-cafe-100 bg-cafe-50/70 p-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-cafe-700">
              Search / select item
            </label>
            <input
              type="search"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Type item name…"
              disabled={busy}
              className="input-field"
              autoFocus
            />
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              disabled={busy}
              className="input-field mt-2"
              size={Math.min(6, Math.max(3, filteredItems.length || 3))}
            >
              <option value="">— Select menu item —</option>
              {filteredItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.image_url ? "" : " (no photo)"}
                </option>
              ))}
            </select>
            {filteredItems.length === 0 && (
              <p className="mt-1 text-xs text-cafe-500">No items match that name.</p>
            )}
          </div>

          {selectedItem && (
            <div className="flex items-center gap-3 rounded-lg border border-cafe-100 bg-white px-3 py-2">
              {selectedItem.image_url ? (
                <LazyMenuImage
                  src={selectedItem.image_url}
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-cafe-100 text-[10px] text-cafe-400">
                  No photo
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-cafe-900">{selectedItem.name}</p>
                <p className="text-xs text-cafe-500">Current photo shown — pick a new one below</p>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-cafe-700">
              New photo
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={busy || !selectedItemId}
              onChange={(e) => onPickPhoto(e.target.files)}
              className="input-field py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-cafe-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-cafe-800 disabled:opacity-50"
            />
            {pendingPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingPreview}
                alt="New photo preview"
                className="mt-2 h-20 w-20 rounded-xl object-cover"
              />
            ) : null}
          </div>

          <button
            type="button"
            onClick={addToQueue}
            disabled={busy || !selectedItemId || !pendingFile}
            className="btn-secondary w-full disabled:opacity-50"
          >
            Add to list
          </button>
        </div>

        {error && (
          <div className="mt-3 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {summary && (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {summary}
          </div>
        )}

        {queue.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-cafe-700">
              Ready to save ({queue.length})
            </p>
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {queue.map((row) => {
                const item = items.find((i) => i.id === row.itemId);
                return (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-xl border border-cafe-100 bg-white px-3 py-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.previewUrl}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-cafe-900">
                      {item?.name || "Item"}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeFromQueue(row.id)}
                      disabled={busy}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyQueue}
            disabled={busy || queue.length === 0}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {busy
              ? progress || "Saving…"
              : `Save ${queue.length || ""} photo${queue.length === 1 ? "" : "s"}`.trim()}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
