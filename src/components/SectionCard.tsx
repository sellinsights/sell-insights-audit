"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNotesContext } from "./NotesContext";

const NOTES_MIN_HEIGHT_PX = 200; // ~10 lines

function NotepadIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M9 7h6M9 11h6M9 15h3" />
    </svg>
  );
}

function NotesPanel({ sectionKey, open }: { sectionKey: string; open: boolean }) {
  const notes = useNotesContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const value = notes?.getNote(sectionKey) ?? "";
  const status = notes?.getSaveStatus(sectionKey) ?? "idle";

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, NOTES_MIN_HEIGHT_PX)}px`;
  }, []);

  // Re-measure whenever the panel opens or its content changes (e.g. loaded
  // from cache) — not just on keystrokes, so pre-existing multi-line notes
  // are sized correctly the instant the panel appears.
  useEffect(() => {
    if (open) resize();
  }, [open, value, resize]);

  return (
    <div
      className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${
        open ? "mb-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0">
        <div className="rounded-lg border border-neutral-200 bg-[#F8F9FA] p-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              notes?.setNote(sectionKey, e.target.value);
              resize();
            }}
            onInput={resize}
            placeholder="Add notes for this section…"
            style={{ minHeight: NOTES_MIN_HEIGHT_PX }}
            className="w-full resize-none overflow-hidden border-none bg-transparent text-sm leading-relaxed text-neutral-800 outline-none placeholder:text-neutral-400"
          />
          <div className="mt-1 h-4 text-right text-xs text-neutral-400">
            {status === "saving" && "Saving…"}
            {status === "saved" && "Saved"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  sectionKey,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Opts this section into the Notes feature — pass a unique key (see
   * src/lib/data/notes.ts) and SectionCard handles the toggle button, panel,
   * and auto-save entirely on its own. Omit to render a plain section with
   * no Notes button. */
  sectionKey?: string;
}) {
  const notes = useNotesContext();
  const [notesOpen, setNotesOpen] = useState(false);
  const notesEnabled = !!sectionKey && !!notes;
  const hasNotes = notesEnabled && notes.getNote(sectionKey).trim().length > 0;

  return (
    <section
      className="relative rounded-xl border border-[rgba(0,179,65,0.25)] bg-white/60 p-5 shadow-[0_0_12px_rgba(0,179,65,0.08)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] rounded-t-xl"
        style={{ background: "linear-gradient(90deg, #00B341, #00D94E)" }}
      />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-navy">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {notesEnabled && (
            <button
              type="button"
              onClick={() => setNotesOpen((open) => !open)}
              aria-expanded={notesOpen}
              aria-label="Notes"
              className={`flex items-center gap-1.5 rounded-md border border-[rgba(0,179,65,0.3)] px-2.5 py-1.5 text-xs font-semibold text-navy transition-colors ${
                hasNotes ? "bg-[rgba(0,179,65,0.1)]" : "hover:bg-[rgba(0,179,65,0.05)]"
              }`}
            >
              <NotepadIcon className="h-3.5 w-3.5 text-green" />
              {hasNotes && <span>has content</span>}
            </button>
          )}
        </div>
      </div>

      {notesEnabled && <NotesPanel sectionKey={sectionKey} open={notesOpen} />}

      {children}
    </section>
  );
}
