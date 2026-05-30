"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSpreadsheetStore } from "@/lib/store";

export function SheetTabs() {
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const setActiveSheet = useSpreadsheetStore((state) => state.setActiveSheet);
  const addSheet = useSpreadsheetStore((state) => state.addSheet);
  const deleteSheet = useSpreadsheetStore((state) => state.deleteSheet);
  const renameSheet = useSpreadsheetStore((state) => state.renameSheet);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const inlineInputRef = useRef<HTMLInputElement | null>(null);
  const floatingInputRef = useRef<HTMLInputElement | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (editingSheetId) {
      requestAnimationFrame(() => {
        const input = floatingInputRef.current ?? inlineInputRef.current;
        input?.focus();
        input?.select();
        input?.scrollIntoView({ block: "center", inline: "center" });
      });
    }
  }, [editingSheetId]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const updateKeyboardInset = () => {
      setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };

    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
    };
  }, []);

  const beginRename = (sheetId: string, currentName: string) => {
    setActiveSheet(sheetId);
    setEditingSheetId(sheetId);
    setDraftName(currentName);
  };

  const commitRename = () => {
    if (!editingSheetId) {
      return;
    }

    const nextName = draftName.trim();
    if (nextName) {
      renameSheet(editingSheetId, nextName);
    }
    setEditingSheetId(null);
    setDraftName("");
  };

  const confirmDelete = (sheetId: string, sheetName: string) => {
    if (sheets.length === 1) {
      window.alert("You need at least one sheet in the workbook.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${sheetName}"? This cannot be undone.`)) {
      deleteSheet(sheetId);
    }
  };

  const renameInput = (ref: RefObject<HTMLInputElement>, className: string) => (
    <input
      ref={ref}
      value={draftName}
      onChange={(event) => setDraftName(event.target.value)}
      onBlur={commitRename}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitRename();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setEditingSheetId(null);
          setDraftName("");
        }
      }}
      className={className}
      aria-label="Rename sheet"
    />
  );

  return (
    <>
      <div className="flex h-[var(--tabs-height)] items-center gap-2 overflow-x-auto border-t border-neutral-300 bg-[#f7f7f5] px-3">
        {sheets.map((sheet) => {
          const active = sheet.id === activeSheetId;
          const editing = sheet.id === editingSheetId;

          return (
            <div
              key={sheet.id}
              className={
                active
                  ? "flex h-8 shrink-0 items-center gap-1 rounded-[18px] border border-[#2F7D4D]/20 bg-[#2F7D4D] px-3 text-xs font-bold text-white"
                  : "flex h-8 shrink-0 items-center gap-1 rounded-[18px] border border-transparent px-3 text-xs font-semibold text-neutral-600 hover:bg-white"
              }
            >
              {editing ? (
                <span className="hidden sm:block">
                  {renameInput(
                    inlineInputRef,
                    "h-7 w-32 rounded-[14px] border border-white/40 bg-white px-2 font-bold text-neutral-950 outline-none"
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (active && window.matchMedia("(max-width: 640px)").matches) {
                      beginRename(sheet.id, sheet.name);
                      return;
                    }
                    setActiveSheet(sheet.id);
                  }}
                  onDoubleClick={() => beginRename(sheet.id, sheet.name)}
                  className="min-w-16 text-left"
                  title="Double-click to rename"
                >
                  {sheet.name}
                </button>
              )}
              {editing ? <span className="sm:hidden">{sheet.name}</span> : null}
              <button
                type="button"
                aria-label={`Delete ${sheet.name}`}
                className="grid h-6 w-6 place-items-center rounded-[14px] text-current opacity-75 hover:bg-white/20"
                onClick={() => confirmDelete(sheet.id, sheet.name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addSheet}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[18px] text-neutral-600 transition hover:bg-white"
          aria-label="Add sheet"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {editingSheetId ? (
        <div
          className="fixed left-3 right-3 z-50 rounded-[22px] border border-neutral-200 bg-white p-3 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:hidden"
          style={{ bottom: keyboardInset + 12 }}
        >
          <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
            Rename sheet
          </label>
          {renameInput(
            floatingInputRef,
            "mt-2 h-11 w-full rounded-[18px] border border-neutral-300 bg-white px-3 font-bold text-neutral-950 outline-none focus:border-[#2F7D4D]"
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="h-9 rounded-[16px] px-4 text-sm font-bold text-neutral-600"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setEditingSheetId(null);
                setDraftName("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-9 rounded-[16px] bg-[#2F7D4D] px-4 text-sm font-bold text-white"
              onMouseDown={(event) => event.preventDefault()}
              onClick={commitRename}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
