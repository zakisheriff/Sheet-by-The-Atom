"use client";

import { useMemo } from "react";
import { cellKey, normalizeRange } from "@/lib/grid";
import { useSpreadsheetStore } from "@/lib/store";

export function StatusBar() {
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const selection = useSpreadsheetStore((state) => state.selection);

  const stats = useMemo(() => {
    const sheet = sheets.find((candidate) => candidate.id === activeSheetId) ?? sheets[0];
    const range = normalizeRange(selection);
    let sum = 0;
    let count = 0;
    let min: number | null = null;
    let max: number | null = null;

    for (let row = range.start.row; row <= range.end.row; row += 1) {
      for (let col = range.start.col; col <= range.end.col; col += 1) {
        const value = sheet.cells[cellKey({ row, col })]?.value;
        if (typeof value === "number" && Number.isFinite(value)) {
          sum += value;
          count += 1;
          min = min === null ? value : Math.min(min, value);
          max = max === null ? value : Math.max(max, value);
        }
      }
    }

    return {
      sum,
      average: count === 0 ? 0 : sum / count,
      count,
      min,
      max
    };
  }, [activeSheetId, selection, sheets]);

  return (
    <div className="flex h-[var(--status-height)] items-center justify-end gap-4 overflow-x-auto border-t border-neutral-300 bg-[#f7f7f5] px-3 text-xs font-medium text-neutral-600">
      <span>SUM {stats.sum.toLocaleString()}</span>
      <span>AVERAGE {stats.average.toLocaleString()}</span>
      <span>COUNT {stats.count.toLocaleString()}</span>
      <span>MIN {stats.min === null ? 0 : stats.min.toLocaleString()}</span>
      <span>MAX {stats.max === null ? 0 : stats.max.toLocaleString()}</span>
    </div>
  );
}
