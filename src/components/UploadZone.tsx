"use client";

import { useRef, useState, type ReactNode } from "react";

export function UploadZone({
  label,
  description,
  accept,
  file,
  onChange,
  disabled = false,
  extra,
}: {
  label: string;
  description: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
        disabled
          ? "border-neutral-200 bg-neutral-50 opacity-60"
          : dragOver
            ? "border-green bg-green-light"
            : file
              ? "border-green/60 bg-green-light/40"
              : "border-neutral-300 bg-white hover:border-navy-light"
      }`}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onChange(dropped);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">{label}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
        </div>
        {extra}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          Choose file
        </button>
        {file ? (
          <span className="flex items-center gap-2 text-xs text-navy">
            <span className="inline-block h-2 w-2 rounded-full bg-green" />
            {file.name}
          </span>
        ) : (
          <span className="text-xs text-neutral-400">or drag & drop here — {accept}</span>
        )}
        {file && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-neutral-400 underline hover:text-red-500"
          >
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
