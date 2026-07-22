"use client";

import { useActionState, useRef, useState } from "react";
import { createBrand, type CreateBrandState } from "@/app/dashboard/actions";

const initialState: CreateBrandState = { error: null };

export function CreateBrandForm({ onCreated }: { onCreated?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: CreateBrandState, formData: FormData) => {
    const result = await createBrand(prev, formData);
    if (!result.error) {
      formRef.current?.reset();
      setOpen(false);
      onCreated?.();
    }
    return result;
  }, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-dark"
      >
        + New Brand
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-2">
      <input
        name="name"
        required
        autoFocus
        placeholder="Brand name"
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green focus:ring-1 focus:ring-green"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-dark disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:text-navy"
      >
        Cancel
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
