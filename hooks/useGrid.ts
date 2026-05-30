"use client";

import { useMemo } from "react";
import type { CellAddress, Sheet } from "@/lib/grid";
import { GRID, columnAtOffset, rowAtOffset } from "@/lib/grid";
import { useSpreadsheetStore } from "@/lib/store";

export type Viewport = {
  width: number;
  height: number;
  scrollLeft: number;
  scrollTop: number;
};

export type VisibleRange = {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

export function getVisibleRange(sheet: Sheet, viewport: Viewport): VisibleRange {
  const rowStart = Math.max(0, rowAtOffset(sheet, viewport.scrollTop) - 2);
  const rowEnd = Math.min(GRID.rowCount - 1, rowAtOffset(sheet, viewport.scrollTop + viewport.height) + 2);
  const colStart = Math.max(0, columnAtOffset(sheet, viewport.scrollLeft) - 2);
  const colEnd = Math.min(GRID.columnCount - 1, columnAtOffset(sheet, viewport.scrollLeft + viewport.width) + 2);

  return { rowStart, rowEnd, colStart, colEnd };
}

export function pointToCell(sheet: Sheet, x: number, y: number, viewport: Viewport): CellAddress {
  const col =
    x < GRID.rowHeaderWidth + GRID.frozenColumns * GRID.columnWidth
      ? columnAtOffset(sheet, Math.max(0, x - GRID.rowHeaderWidth))
      : columnAtOffset(sheet, x - GRID.rowHeaderWidth + viewport.scrollLeft);
  const row =
    y < GRID.columnHeaderHeight + GRID.frozenRows * GRID.rowHeight
      ? rowAtOffset(sheet, Math.max(0, y - GRID.columnHeaderHeight))
      : rowAtOffset(sheet, y - GRID.columnHeaderHeight + viewport.scrollTop);

  return {
    row: Math.max(0, row),
    col: Math.max(0, col)
  };
}

export function useGridMetrics(viewport: Viewport) {
  const sheet = useSpreadsheetStore((state) => state.getActiveSheet());

  return useMemo(
    () => ({
      visibleRange: getVisibleRange(sheet, viewport),
      rowHeight: GRID.rowHeight,
      columnWidth: GRID.columnWidth,
      rowHeaderWidth: GRID.rowHeaderWidth,
      columnHeaderHeight: GRID.columnHeaderHeight,
      sheet
    }),
    [sheet, viewport]
  );
}
