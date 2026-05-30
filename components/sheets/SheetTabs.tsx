"use client";

import { Plus, Trash2 } from "lucide-react";
import { useSpreadsheetStore } from "@/lib/store";

export function SheetTabs() {
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const setActiveSheet = useSpreadsheetStore((state) => state.setActiveSheet);
  const addSheet = useSpreadsheetStore((state) => state.addSheet);
  const deleteSheet = useSpreadsheetStore((state) => state.deleteSheet);
  const renameSheet = useSpreadsheetStore((state) => state.renameSheet);

  return (
    <div className="flex h-[var(--tabs-height)] items-center gap-2 border-t border-neutral-300 bg-[#f7f7f5] px-3">
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className={
            sheet.id === activeSheetId
              ? "flex h-7 items-center gap-1 rounded-md border border-[#217346]/20 bg-[#217346] px-3 text-xs font-semibold text-white"
              : "flex h-7 items-center gap-1 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 hover:bg-white"
          }
        >
          <button type="button" onClick={() => setActiveSheet(sheet.id)} className="min-w-16 text-left">
            {sheet.name}
          </button>
          <button
            type="button"
            aria-label={`Rename ${sheet.name}`}
            className="h-5 rounded px-1 text-current opacity-70 hover:bg-white/20"
            onClick={() => {
              const nextName = window.prompt("Sheet name", sheet.name);
              if (nextName) {
                renameSheet(sheet.id, nextName);
              }
            }}
          >
            ...
          </button>
          <button
            type="button"
            aria-label={`Delete ${sheet.name}`}
            className="grid h-5 w-5 place-items-center rounded text-current opacity-70 hover:bg-white/20"
            onClick={() => deleteSheet(sheet.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addSheet}
        className="grid h-7 w-7 place-items-center rounded-md text-neutral-600 transition hover:bg-white"
        aria-label="Add sheet"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
