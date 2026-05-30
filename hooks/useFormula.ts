"use client";

import { useMemo } from "react";
import { cellKey, createEmptyCell } from "@/lib/grid";
import { getCellPrecedents, getFormulaSuggestions } from "@/lib/hyperformula";
import { useSpreadsheetStore } from "@/lib/store";

export function useFormula() {
  const selection = useSpreadsheetStore((state) => state.selection);
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const cell = useMemo(() => {
    const sheet = sheets.find((candidate) => candidate.id === activeSheetId) ?? sheets[0];
    return sheet.cells[cellKey(selection.end)] ?? createEmptyCell();
  }, [activeSheetId, selection.end, sheets]);

  return useMemo(
    () => ({
      formulaText: cell.formula ?? cell.displayValue,
      precedents: getCellPrecedents(selection.end),
      suggestionsFor: getFormulaSuggestions
    }),
    [cell.displayValue, cell.formula, selection.end]
  );
}
