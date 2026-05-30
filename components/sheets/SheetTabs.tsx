"use client";

import { useEffect, useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingSheetId) {
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editingSheetId]);

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

  return (
    <div className="flex h-[var(--tabs-height)] items-center gap-2 border-t border-neutral-300 bg-[#f7f7f5] px-3">
      {sheets.map((sheet) => {
        const active = sheet.id === activeSheetId;
        const editing = sheet.id === editingSheetId;

        return (
          <div
            key={sheet.id}
            className={
              active
                ? "flex h-8 items-center gap-1 rounded-[18px] border border-[#2F7D4D]/20 bg-[#2F7D4D] px-3 text-xs font-bold text-white"
                : "flex h-8 items-center gap-1 rounded-[18px] border border-transparent px-3 text-xs font-semibold text-neutral-600 hover:bg-white"
            }
          >
            {editing ? (
              <input
                ref={inputRef}
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
                className="h-6 w-28 rounded-[14px] border border-white/40 bg-white px-2 text-xs font-bold text-neutral-950 outline-none"
                aria-label={`Rename ${sheet.name}`}
              />
            ) : (
              <button
                type="button"
                onClick={() => setActiveSheet(sheet.id)}
                onDoubleClick={() => beginRename(sheet.id, sheet.name)}
                className="min-w-16 text-left"
                title="Double-click to rename"
              >
                {sheet.name}
              </button>
            )}
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
        className="grid h-8 w-8 place-items-center rounded-[18px] text-neutral-600 transition hover:bg-white"
        aria-label="Add sheet"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
