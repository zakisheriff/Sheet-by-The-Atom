"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FunctionSquare } from "lucide-react";
import { addressLabel, cellKey, createEmptyCell } from "@/lib/grid";
import { getFormulaSuggestions } from "@/lib/hyperformula";
import { useSpreadsheetStore } from "@/lib/store";

export function FormulaBar() {
  const selection = useSpreadsheetStore((state) => state.selection);
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const setCellInput = useSpreadsheetStore((state) => state.setCellInput);
  const cell = useMemo(() => {
    const sheet = sheets.find((candidate) => candidate.id === activeSheetId) ?? sheets[0];
    return sheet.cells[cellKey(selection.end)] ?? createEmptyCell();
  }, [activeSheetId, selection.end, sheets]);
  const [value, setValue] = useState(cell.formula ?? cell.displayValue);

  useEffect(() => {
    setValue(cell.formula ?? cell.displayValue);
  }, [cell.displayValue, cell.formula, selection.end]);

  const suggestions = useMemo(() => {
    if (!value.startsWith("=")) {
      return [];
    }
    return getFormulaSuggestions(value.slice(1)).slice(0, 5);
  }, [value]);

  return (
    <div className="flex h-[var(--formula-height)] items-center gap-2 border-b border-neutral-300 bg-white px-2">
      <div className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700">
        {addressLabel(selection.end)}
      </div>
      <FunctionSquare aria-hidden="true" className="h-4 w-4 text-neutral-500" />
      <div className="relative flex-1">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setCellInput(selection.end, value);
            }
          }}
        className="h-7 w-full rounded border border-neutral-200 bg-white px-2 font-mono text-xs outline-none transition focus:border-[#217346]"
          aria-label="Formula bar"
        />
        {suggestions.length > 0 ? (
          <div className="absolute left-0 top-8 z-40 w-56 rounded-md border border-neutral-200 bg-white py-1 text-xs">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-blue-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setValue(`=${suggestion}(`);
                }}
              >
                <span>{suggestion}</span>
                <span className="text-neutral-400">fx</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded border border-neutral-300 text-neutral-700 transition hover:bg-neutral-50"
        onClick={() => setCellInput(selection.end, value)}
        aria-label="Apply formula"
      >
        <Check className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
