"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveAuditNote } from "@/lib/data/notes";

export type NoteSaveStatus = "idle" | "saving" | "saved";

interface NotesContextValue {
  getNote: (sectionKey: string) => string;
  setNote: (sectionKey: string, content: string) => void;
  getSaveStatus: (sectionKey: string) => NoteSaveStatus;
}

const NotesContext = createContext<NotesContextValue | null>(null);

/** SectionCard reads this — returns null when no NotesProvider is mounted
 * above it, in which case SectionCard just doesn't render a Notes button. */
export function useNotesContext() {
  return useContext(NotesContext);
}

const SAVE_DEBOUNCE_MS = 1000;
const SAVED_INDICATOR_MS = 2000;

/** Owns every section's note content for one audit: local state for
 * instant-feeling typing, a per-section debounced (1s) save to Supabase, and
 * a save-status flag the textarea's "Saving…"/"Saved" indicator reads.
 * `onNotesChange` fires once a save actually succeeds, with the full updated
 * map, so the page can write it into the cached audit bundle — that's what
 * makes edited notes show up instantly on the next cache-hit visit instead
 * of only after a real re-fetch. */
export function NotesProvider({
  auditId,
  initialNotes,
  onNotesChange,
  children,
}: {
  auditId: string;
  initialNotes: Record<string, string>;
  onNotesChange?: (notes: Record<string, string>) => void;
  children: ReactNode;
}) {
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes);
  const [saveStatus, setSaveStatus] = useState<Record<string, NoteSaveStatus>>({});
  const notesRef = useRef(initialNotes);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const hideTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const getNote = useCallback((sectionKey: string) => notes[sectionKey] ?? "", [notes]);
  const getSaveStatus = useCallback((sectionKey: string) => saveStatus[sectionKey] ?? "idle", [saveStatus]);

  const setNote = useCallback(
    (sectionKey: string, content: string) => {
      const next = { ...notesRef.current, [sectionKey]: content };
      notesRef.current = next;
      setNotes(next);
      setSaveStatus((prev) => ({ ...prev, [sectionKey]: "saving" }));

      const pendingSave = saveTimersRef.current[sectionKey];
      if (pendingSave) clearTimeout(pendingSave);
      const pendingHide = hideTimersRef.current[sectionKey];
      if (pendingHide) clearTimeout(pendingHide);

      saveTimersRef.current[sectionKey] = setTimeout(() => {
        void (async () => {
          try {
            const supabase = createClient();
            await saveAuditNote(supabase, auditId, sectionKey, content);
            onNotesChange?.(notesRef.current);
            setSaveStatus((prev) => ({ ...prev, [sectionKey]: "saved" }));
            hideTimersRef.current[sectionKey] = setTimeout(() => {
              setSaveStatus((prev) => ({ ...prev, [sectionKey]: "idle" }));
            }, SAVED_INDICATOR_MS);
          } catch (err) {
            console.error(`[NOTES] Failed to save note for ${sectionKey}:`, err);
            setSaveStatus((prev) => ({ ...prev, [sectionKey]: "idle" }));
          }
        })();
      }, SAVE_DEBOUNCE_MS);
    },
    [auditId, onNotesChange]
  );

  return <NotesContext.Provider value={{ getNote, setNote, getSaveStatus }}>{children}</NotesContext.Provider>;
}
