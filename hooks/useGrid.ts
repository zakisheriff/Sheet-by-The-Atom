"use client";

import { useMemo } from "react";
import type { CellAddress, Sheet } from "@/lib/grid";
import { GRID, columnAtOffset, columnWidth, rowAtOffset, rowHeight } from "@/lib/grid";
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

function frozenColumnsWidth(sheet: Sheet) {
  let width = 0;
  for (let col = 0; col < GRID.frozenColumns; col += 1) {
    width += columnWidth(sheet, col);
  }
  return width;
}

function frozenRowsHeight(sheet: Sheet) {
  let height = 0;
  for (let row = 0; row < GRID.frozenRows; row += 1) {
    height += rowHeight(sheet, row);
  }
  return height;
}

export function getVisibleRange(sheet: Sheet, viewport: Viewport): VisibleRange {
  const frozenWidth = frozenColumnsWidth(sheet);
  const frozenHeight = frozenRowsHeight(sheet);
  const horizontalOrigin = viewport.scrollLeft + frozenWidth;
  const verticalOrigin = viewport.scrollTop + frozenHeight;
  const rowStart = Math.max(0, rowAtOffset(sheet, verticalOrigin) - 2);
  const rowEnd = Math.min(GRID.rowCount - 1, rowAtOffset(sheet, verticalOrigin + viewport.height) + 2);
  const colStart = Math.max(0, columnAtOffset(sheet, horizontalOrigin) - 2);
  const colEnd = Math.min(GRID.columnCount - 1, columnAtOffset(sheet, horizontalOrigin + viewport.width) + 2);

  return { rowStart, rowEnd, colStart, colEnd };
}

export function pointToCell(sheet: Sheet, x: number, y: number, viewport: Viewport): CellAddress {
  const frozenWidth = frozenColumnsWidth(sheet);
  const frozenHeight = frozenRowsHeight(sheet);
  const horizontalOrigin = viewport.scrollLeft + frozenWidth;
  const verticalOrigin = viewport.scrollTop + frozenHeight;
  const col =
    x < GRID.rowHeaderWidth + frozenWidth
      ? columnAtOffset(sheet, Math.max(0, x - GRID.rowHeaderWidth))
      : columnAtOffset(sheet, horizontalOrigin + x - GRID.rowHeaderWidth - frozenWidth);
  const row =
    y < GRID.columnHeaderHeight + frozenHeight
      ? rowAtOffset(sheet, Math.max(0, y - GRID.columnHeaderHeight))
      : rowAtOffset(sheet, verticalOrigin + y - GRID.columnHeaderHeight - frozenHeight);

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
