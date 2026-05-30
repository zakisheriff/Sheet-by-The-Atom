"use client";

import { addressLabel, normalizeRange } from "@/lib/grid";
import { useSpreadsheetStore } from "@/lib/store";

export function SelectionOverlay() {
  const selection = useSpreadsheetStore((state) => state.selection);
  const range = normalizeRange(selection);
  const label =
    range.start.row === range.end.row && range.start.col === range.end.col
      ? addressLabel(range.start)
      : `${addressLabel(range.start)}:${addressLabel(range.end)}`;

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-accent">
      {label}
    </div>
  );
}
