"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cellKey, addressLabel } from "@/lib/grid";
import { useSpreadsheetStore } from "@/lib/store";

type FindReplaceDialogProps = {
  open: boolean;
  onClose: () => void;
  onNotify: (message: string) => void;
};

export function FindReplaceDialog({ open, onClose, onNotify }: FindReplaceDialogProps) {
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const selectCell = useSpreadsheetStore((state) => state.selectCell);
  const replaceAll = useSpreadsheetStore((state) => state.replaceAll);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId) ?? sheets[0];

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }

    return Object.entries(activeSheet.cells)
      .flatMap(([key, cell]) => {
        const [rowPart, colPart] = key.split(":");
        const row = Number.parseInt(rowPart, 10);
        const col = Number.parseInt(colPart, 10);
        const source = cell.formula ?? cell.displayValue;
        return source.toLowerCase().includes(needle)
          ? [{ address: { row, col }, preview: source }]
          : [];
      })
      .slice(0, 8);
  }, [activeSheet.cells, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/15 p-3 sm:p-8" onMouseDown={onClose}>
      <section
        className="mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Find and replace"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4 text-[#217346]" />
            Find and replace
          </div>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Close find and replace"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 p-4">
          <label className="block text-xs font-semibold text-neutral-600">
            Find
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-[#217346]"
            />
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            Replace with
            <input
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-[#217346]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-[#217346] px-3 py-2 text-sm font-semibold text-white hover:bg-[#195c37]"
              onClick={() => {
                const [match] = matches;
                if (!match) {
                  onNotify("No matches found");
                  return;
                }
                selectCell(match.address);
                onNotify(`Selected ${addressLabel(match.address)}`);
              }}
            >
              Find next
            </button>
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              onClick={() => {
                const count = replaceAll(query, replacement);
                onNotify(count === 1 ? "Replaced 1 cell" : `Replaced ${count} cells`);
              }}
            >
              Replace all
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto border-t border-neutral-200 p-2">
          {matches.length === 0 ? (
            <p className="px-2 py-4 text-sm text-neutral-500">No matches in this sheet.</p>
          ) : (
            matches.map((match) => (
              <button
                key={cellKey(match.address)}
                type="button"
                className="grid w-full grid-cols-[72px_1fr] gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-green-50"
                onClick={() => {
                  selectCell(match.address);
                  onClose();
                }}
              >
                <span className="font-semibold text-[#217346]">{addressLabel(match.address)}</span>
                <span className="truncate text-neutral-700">{match.preview}</span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
