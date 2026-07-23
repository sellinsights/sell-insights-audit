"use client";

import { useState } from "react";

/** Type-to-confirm delete dialog, reused for both brands and audits — the
 * button itself is a plain sibling element (not nested inside the card's
 * <Link>), so no click-propagation tricks are needed to keep it from
 * triggering navigation. */
export function DeleteConfirmButton({
  itemName,
  itemLabel,
  onConfirm,
}: {
  /** The exact name/title the user must retype to confirm. */
  itemName: string;
  /** Lowercase noun used in copy, e.g. "brand" or "audit". */
  itemLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canConfirm = typed.trim() === itemName.trim() && typed.trim().length > 0;

  function close() {
    if (pending) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      // No need to reset state on success — the caller navigates/removes
      // this component from the tree.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${itemLabel}`}
        className="rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:border-red-400 hover:bg-red-50"
      >
        Delete
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-navy">Delete this {itemLabel}?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              This will permanently delete <strong className="text-navy">{itemName}</strong> and all
              of its data. This cannot be undone.
            </p>
            <p className="mt-3 text-xs text-neutral-500">
              Type <strong className="text-navy">{itemName}</strong> to confirm.
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={pending}
              autoFocus
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 disabled:opacity-60"
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:text-navy disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!canConfirm || pending}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
