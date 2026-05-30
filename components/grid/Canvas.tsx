"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Copy, Columns3, Rows3, Trash2 } from "lucide-react";
import { useGridMetrics, pointToCell, type Viewport } from "@/hooks/useGrid";
import type { CellAddress, CellRange, Sheet } from "@/lib/grid";
import {
  CELL_FONT,
  GRID,
  addressLabel,
  cellKey,
  clampColumnWidth,
  clampRowHeight,
  columnName,
  columnOffset,
  columnWidth,
  columnAtOffset,
  isCellInRange,
  normalizeRange,
  rowAtOffset,
  rowHeight,
  rowOffset,
  sheetPixelHeight,
  sheetPixelWidth
} from "@/lib/grid";
import { getCellPrecedents } from "@/lib/hyperformula";
import { useSpreadsheetStore } from "@/lib/store";

type CanvasGridProps = {
  onViewportChange: (viewport: Viewport) => void;
};

const fillHandleSize = 7;
const fillHandleHitSize = 16;
const resizeHitSize = 5;
const sheetBackground = "#FFFFFF";
const sheetGridLine = "#E5E5E5";
const sheetHeaderBackground = "#F8F8F8";
const sheetHeaderDivider = "#B8B8B8";
const fillHandleCursor =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27 viewBox=%270 0 20 20%27%3E%3Cpath d=%27M10 3v14M3 10h14%27 stroke=%27%23000%27 stroke-width=%272.4%27 stroke-linecap=%27square%27/%3E%3C/svg%3E") 10 10, crosshair';

type ResizeHit = { kind: "column" | "row"; index: number };
type ResizeDrag = ResizeHit & {
  startClient: number;
  startSize: number;
  currentSize: number;
};

function getCellRect(sheet: Sheet, address: CellAddress, viewport: Viewport) {
  const isFrozenCol = address.col < GRID.frozenColumns;
  const isFrozenRow = address.row < GRID.frozenRows;
  const width = columnWidth(sheet, address.col);
  const height = rowHeight(sheet, address.row);
  const frozenWidth = frozenColumnsWidth(sheet);
  const frozenHeight = frozenRowsHeight(sheet);
  const horizontalOrigin = viewport.scrollLeft + frozenWidth;
  const verticalOrigin = viewport.scrollTop + frozenHeight;

  return {
    x: isFrozenCol
      ? GRID.rowHeaderWidth + columnOffset(sheet, address.col)
      : GRID.rowHeaderWidth + frozenWidth + columnOffset(sheet, address.col) - horizontalOrigin,
    y: isFrozenRow
      ? GRID.columnHeaderHeight + rowOffset(sheet, address.row)
      : GRID.columnHeaderHeight + frozenHeight + rowOffset(sheet, address.row) - verticalOrigin,
    width,
    height,
    isFrozenCol,
    isFrozenRow
  };
}

function mergeRangeForCell(sheet: Sheet, address: CellAddress): CellRange | null {
  for (const range of sheet.mergedCells) {
    const normalized = normalizeRange(range);
    if (
      address.row >= normalized.start.row &&
      address.row <= normalized.end.row &&
      address.col >= normalized.start.col &&
      address.col <= normalized.end.col
    ) {
      return normalized;
    }
  }

  return null;
}

function isMergeChild(sheet: Sheet, address: CellAddress) {
  const mergeRange = mergeRangeForCell(sheet, address);
  return Boolean(
    mergeRange && (address.row !== mergeRange.start.row || address.col !== mergeRange.start.col)
  );
}

function paintOrder(indexes: number[], frozenCount: number) {
  return [...indexes].sort((left, right) => {
    const leftFrozen = left < frozenCount;
    const rightFrozen = right < frozenCount;
    if (leftFrozen !== rightFrozen) {
      return leftFrozen ? 1 : -1;
    }
    return left - right;
  });
}

function getRangeRect(sheet: Sheet, range: CellRange, viewport: Viewport) {
  const normalized = normalizeRange(range);
  const startRect = getCellRect(sheet, normalized.start, viewport);
  const endRect = getCellRect(sheet, normalized.end, viewport);
  const x = Math.min(startRect.x, endRect.x);
  const y = Math.min(startRect.y, endRect.y);
  const width = Math.abs(endRect.x - startRect.x) + endRect.width;
  const height = Math.abs(endRect.y - startRect.y) + endRect.height;

  return { x, y, width, height };
}

function drawCellText(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  address: CellAddress,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const cell = sheet.cells[cellKey(address)];
  if (!cell?.displayValue) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, y + 1, width - 2, height - 2);
  ctx.clip();
  ctx.font = `${cell.style.italic ? "italic " : ""}${cell.style.bold ? "600 " : ""}${
    cell.style.fontSize ?? 12
  }px ${cell.style.fontFamily ?? "SFMono-Regular, Consolas, Liberation Mono, monospace"}`;
  ctx.fillStyle = cell.error ? "#D70015" : cell.style.textColor ?? "#171717";
  ctx.textBaseline = "middle";
  ctx.textAlign = cell.style.align ?? (typeof cell.value === "number" ? "right" : "left");
  const textX =
    ctx.textAlign === "right" ? x + width - 8 : ctx.textAlign === "center" ? x + width / 2 : x + 8;
  ctx.fillText(cell.displayValue, textX, y + height / 2);
  if (cell.style.underline) {
    const metrics = ctx.measureText(cell.displayValue);
    const underlineWidth = Math.min(metrics.width, width - 16);
    const startX =
      ctx.textAlign === "right" ? textX - underlineWidth : ctx.textAlign === "center" ? textX - underlineWidth / 2 : textX;
    ctx.fillRect(startX, y + height / 2 + 8, underlineWidth, 1);
  }
  ctx.restore();
}

function drawCellBorders(
  ctx: CanvasRenderingContext2D,
  borders: Sheet["cells"][string]["style"]["borders"],
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (!borders) {
    return;
  }

  ctx.save();
  ctx.lineCap = "square";

  if (borders.top) {
    ctx.strokeStyle = borders.top.color;
    ctx.lineWidth = borders.top.width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  }
  if (borders.right) {
    ctx.strokeStyle = borders.right.color;
    ctx.lineWidth = borders.right.width;
    ctx.beginPath();
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    ctx.stroke();
  }
  if (borders.bottom) {
    ctx.strokeStyle = borders.bottom.color;
    ctx.lineWidth = borders.bottom.width;
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.stroke();
  }
  if (borders.left) {
    ctx.strokeStyle = borders.left.color;
    ctx.lineWidth = borders.left.width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  address: CellAddress,
  x: number,
  y: number,
  width: number,
  height: number,
  selection: CellRange,
  precedents: CellAddress[]
) {
  const cell = sheet.cells[cellKey(address)];
  ctx.fillStyle = cell?.style.fillColor ?? sheetBackground;
  ctx.fillRect(x, y, width, height);

  if (isCellInRange(address, selection)) {
    ctx.fillStyle = "rgba(0, 102, 255, 0.08)";
    ctx.fillRect(x, y, width, height);
  }

  if (precedents.some((precedent) => precedent.row === address.row && precedent.col === address.col)) {
    ctx.fillStyle = "rgba(52, 199, 89, 0.12)";
    ctx.fillRect(x, y, width, height);
  }

  ctx.strokeStyle = "#E5E5E5";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width, height);
  drawCellText(ctx, sheet, address, x, y, width, height);
  drawCellBorders(ctx, cell?.style.borders, x + 0.5, y + 0.5, width, height);
}

function drawHeaders(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  viewport: Viewport,
  visibleColumns: number[],
  visibleRows: number[]
) {
  const frozenWidth = frozenColumnsWidth(sheet);
  const frozenHeight = frozenRowsHeight(sheet);
  const horizontalOrigin = viewport.scrollLeft + frozenWidth;
  const verticalOrigin = viewport.scrollTop + frozenHeight;

  ctx.save();
  ctx.font = "500 12px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = sheetHeaderBackground;
  ctx.fillRect(0, 0, viewport.width, GRID.columnHeaderHeight);
  ctx.fillRect(0, 0, GRID.rowHeaderWidth, viewport.height);
  ctx.strokeStyle = "#D4D4D4";

  for (const col of paintOrder(visibleColumns, GRID.frozenColumns)) {
    const isFrozen = col < GRID.frozenColumns;
    const width = columnWidth(sheet, col);
    const x = isFrozen
      ? GRID.rowHeaderWidth + columnOffset(sheet, col)
      : GRID.rowHeaderWidth + frozenWidth + columnOffset(sheet, col) - horizontalOrigin;
    ctx.fillStyle = sheetHeaderBackground;
    ctx.fillRect(x, 0, width, GRID.columnHeaderHeight);
    ctx.strokeRect(x + 0.5, 0.5, width, GRID.columnHeaderHeight);
    ctx.fillStyle = "#525252";
    ctx.fillText(columnName(col), x + width / 2, GRID.columnHeaderHeight / 2);
  }

  for (const row of paintOrder(visibleRows, GRID.frozenRows)) {
    const isFrozen = row < GRID.frozenRows;
    const height = rowHeight(sheet, row);
    const y = isFrozen
      ? GRID.columnHeaderHeight + rowOffset(sheet, row)
      : GRID.columnHeaderHeight + frozenHeight + rowOffset(sheet, row) - verticalOrigin;
    ctx.fillStyle = sheetHeaderBackground;
    ctx.fillRect(0, y, GRID.rowHeaderWidth, height);
    ctx.strokeRect(0.5, y + 0.5, GRID.rowHeaderWidth, height);
    ctx.fillStyle = "#525252";
    ctx.fillText(String(row + 1), GRID.rowHeaderWidth / 2, y + height / 2);
  }

  ctx.fillStyle = sheetHeaderBackground;
  ctx.fillRect(0, 0, GRID.rowHeaderWidth, GRID.columnHeaderHeight);
  ctx.fillStyle = "#ECECEC";
  ctx.beginPath();
  ctx.moveTo(0, GRID.columnHeaderHeight);
  ctx.lineTo(GRID.rowHeaderWidth, 0);
  ctx.lineTo(GRID.rowHeaderWidth, GRID.columnHeaderHeight);
  ctx.closePath();
  ctx.fill();
  ctx.strokeRect(0.5, 0.5, GRID.rowHeaderWidth, GRID.columnHeaderHeight);
  ctx.restore();
}

function getSelectionBounds(sheet: Sheet, selection: CellRange, viewport: Viewport) {
  const range = normalizeRange(selection);
  const startMerge = mergeRangeForCell(sheet, range.start);
  const endMerge = mergeRangeForCell(sheet, range.end);
  if (
    startMerge &&
    endMerge &&
    startMerge.start.row === endMerge.start.row &&
    startMerge.start.col === endMerge.start.col &&
    startMerge.end.row === endMerge.end.row &&
    startMerge.end.col === endMerge.end.col
  ) {
    return getRangeRect(sheet, startMerge, viewport);
  }

  const startRect = getCellRect(sheet, range.start, viewport);
  const endRect = getCellRect(sheet, range.end, viewport);
  const x = Math.min(startRect.x, endRect.x);
  const y = Math.min(startRect.y, endRect.y);
  const width = Math.abs(endRect.x - startRect.x) + endRect.width;
  const height = Math.abs(endRect.y - startRect.y) + endRect.height;

  return { x, y, width, height };
}

function isPointOnFillHandle(x: number, y: number, sheet: Sheet, selection: CellRange, viewport: Viewport) {
  const bounds = getSelectionBounds(sheet, selection, viewport);
  const handleCenterX = bounds.x + bounds.width;
  const handleCenterY = bounds.y + bounds.height;

  return (
    Math.abs(x - handleCenterX) <= fillHandleHitSize / 2 &&
    Math.abs(y - handleCenterY) <= fillHandleHitSize / 2
  );
}

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

function columnBoundaryX(sheet: Sheet, col: number, viewport: Viewport) {
  const frozenWidth = frozenColumnsWidth(sheet);
  const horizontalOrigin = viewport.scrollLeft + frozenWidth;

  return (
    (col < GRID.frozenColumns
      ? GRID.rowHeaderWidth + columnOffset(sheet, col)
      : GRID.rowHeaderWidth + frozenWidth + columnOffset(sheet, col) - horizontalOrigin) + columnWidth(sheet, col)
  );
}

function rowBoundaryY(sheet: Sheet, row: number, viewport: Viewport) {
  const frozenHeight = frozenRowsHeight(sheet);
  const verticalOrigin = viewport.scrollTop + frozenHeight;

  return (
    (row < GRID.frozenRows
      ? GRID.columnHeaderHeight + rowOffset(sheet, row)
      : GRID.columnHeaderHeight + frozenHeight + rowOffset(sheet, row) - verticalOrigin) + rowHeight(sheet, row)
  );
}

function drawFrozenBoundaries(ctx: CanvasRenderingContext2D, sheet: Sheet, viewport: Viewport) {
  const frozenWidth = frozenColumnsWidth(sheet);
  const frozenHeight = frozenRowsHeight(sheet);

  ctx.save();
  ctx.strokeStyle = sheetHeaderDivider;
  ctx.lineWidth = 1.5;

  if (frozenWidth > 0) {
    const x = GRID.rowHeaderWidth + frozenWidth + 0.5;
    if (x > GRID.rowHeaderWidth && x < viewport.width) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
      ctx.stroke();
    }
  }

  if (frozenHeight > 0) {
    const y = GRID.columnHeaderHeight + frozenHeight + 0.5;
    if (y > GRID.columnHeaderHeight && y < viewport.height) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(viewport.width, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  selection: CellRange,
  viewport: Viewport,
  preview = false
) {
  const { x, y, width, height } = getSelectionBounds(sheet, selection, viewport);
  const right = x + width;
  const bottom = y + height;
  const clipLeft = Math.max(x, GRID.rowHeaderWidth);
  const clipTop = Math.max(y, GRID.columnHeaderHeight);
  const clipRight = Math.min(right, viewport.width);
  const clipBottom = Math.min(bottom, viewport.height);
  const isVisible = clipRight > clipLeft && clipBottom > clipTop;

  ctx.save();
  ctx.strokeStyle = preview ? "rgba(0, 102, 255, 0.78)" : "#0066FF";
  ctx.lineWidth = preview ? 1.5 : 2;
  if (preview && isVisible) {
    ctx.setLineDash([5, 4]);
    ctx.fillStyle = "rgba(0, 102, 255, 0.045)";
    ctx.fillRect(clipLeft + 1, clipTop + 1, clipRight - clipLeft - 2, clipBottom - clipTop - 2);
  }

  ctx.beginPath();
  if (y >= GRID.columnHeaderHeight && y <= viewport.height) {
    ctx.moveTo(clipLeft + 1, y + 1);
    ctx.lineTo(clipRight - 1, y + 1);
  }
  if (bottom >= GRID.columnHeaderHeight && bottom <= viewport.height) {
    ctx.moveTo(clipLeft + 1, bottom - 1);
    ctx.lineTo(clipRight - 1, bottom - 1);
  }
  if (x >= GRID.rowHeaderWidth && x <= viewport.width) {
    ctx.moveTo(x + 1, clipTop + 1);
    ctx.lineTo(x + 1, clipBottom - 1);
  }
  if (right >= GRID.rowHeaderWidth && right <= viewport.width) {
    ctx.moveTo(right - 1, clipTop + 1);
    ctx.lineTo(right - 1, clipBottom - 1);
  }
  ctx.stroke();

  if (!preview && right <= viewport.width && bottom <= viewport.height) {
    ctx.fillStyle = "#0066FF";
    ctx.fillRect(right - fillHandleSize / 2, bottom - fillHandleSize / 2, fillHandleSize, fillHandleSize);
  }
  ctx.restore();
}

function findResizeHit(sheet: Sheet, x: number, y: number, viewport: Viewport): ResizeHit | null {
  if (y >= 0 && y <= GRID.columnHeaderHeight && x > GRID.rowHeaderWidth) {
    const frozenWidth = frozenColumnsWidth(sheet);
    const horizontalOrigin = viewport.scrollLeft + frozenWidth;
    const offset =
      x <= GRID.rowHeaderWidth + frozenWidth
        ? x - GRID.rowHeaderWidth
        : horizontalOrigin + x - GRID.rowHeaderWidth - frozenWidth;
    const col = columnAtOffset(sheet, offset);
    const candidates = [col - 1, col];

    for (const candidate of candidates) {
      if (candidate < 0 || candidate >= GRID.columnCount) {
        continue;
      }

      if (Math.abs(x - columnBoundaryX(sheet, candidate, viewport)) <= resizeHitSize) {
        return { kind: "column", index: candidate };
      }
    }
  }

  if (x >= 0 && x <= GRID.rowHeaderWidth && y > GRID.columnHeaderHeight) {
    const frozenHeight = frozenRowsHeight(sheet);
    const verticalOrigin = viewport.scrollTop + frozenHeight;
    const offset =
      y <= GRID.columnHeaderHeight + frozenHeight
        ? y - GRID.columnHeaderHeight
        : verticalOrigin + y - GRID.columnHeaderHeight - frozenHeight;
    const row = rowAtOffset(sheet, offset);
    const candidates = [row - 1, row];

    for (const candidate of candidates) {
      if (candidate < 0 || candidate >= GRID.rowCount) {
        continue;
      }

      if (Math.abs(y - rowBoundaryY(sheet, candidate, viewport)) <= resizeHitSize) {
        return { kind: "row", index: candidate };
      }
    }
  }

  return null;
}

function findSelectionResizeHit(
  sheet: Sheet,
  x: number,
  y: number,
  selection: CellRange,
  viewport: Viewport
): ResizeHit | null {
  const range = normalizeRange(selection);
  const bounds = getSelectionBounds(sheet, range, viewport);
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const withinSelectionY = y >= Math.max(bounds.y, GRID.columnHeaderHeight) && y <= Math.min(bottom, viewport.height);
  const withinSelectionX = x >= Math.max(bounds.x, GRID.rowHeaderWidth) && x <= Math.min(right, viewport.width);

  if (isPointOnFillHandle(x, y, sheet, selection, viewport)) {
    return null;
  }

  if (withinSelectionY && Math.abs(x - right) <= resizeHitSize) {
    return { kind: "column", index: range.end.col };
  }

  if (withinSelectionX && Math.abs(y - bottom) <= resizeHitSize) {
    return { kind: "row", index: range.end.row };
  }

  return null;
}

function drawResizeGuide(ctx: CanvasRenderingContext2D, sheet: Sheet, viewport: Viewport, resize: ResizeDrag | null) {
  if (!resize) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = "#0066FF";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  if (resize.kind === "column") {
    const rect = getCellRect(sheet, { row: 0, col: resize.index }, viewport);
    const x = rect.x + resize.currentSize;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewport.height);
  } else {
    const rect = getCellRect(sheet, { row: resize.index, col: 0 }, viewport);
    const y = rect.y + resize.currentSize;
    ctx.moveTo(0, y);
    ctx.lineTo(viewport.width, y);
  }
  ctx.stroke();
  ctx.restore();
}

export function CanvasGrid({ onViewportChange }: CanvasGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pointerStart = useRef<CellAddress | null>(null);
  const pendingDragRange = useRef<CellRange | null>(null);
  const dragAnimationFrame = useRef<number | null>(null);
  const fillDragStart = useRef<CellRange | null>(null);
  const pendingFillPreview = useRef<CellRange | null>(null);
  const fillAnimationFrame = useRef<number | null>(null);
  const resizeDrag = useRef<ResizeDrag | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ width: 800, height: 500, scrollLeft: 0, scrollTop: 0 });
  const [fillPreview, setFillPreview] = useState<CellRange | null>(null);
  const [fillHandleHover, setFillHandleHover] = useState(false);
  const [resizeHover, setResizeHover] = useState<ResizeHit["kind"] | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizeDrag | null>(null);
  const selection = useSpreadsheetStore((state) => state.selection);
  const editMode = useSpreadsheetStore((state) => state.editMode);
  const selectCell = useSpreadsheetStore((state) => state.selectCell);
  const selectRange = useSpreadsheetStore((state) => state.selectRange);
  const fillSelectionTo = useSpreadsheetStore((state) => state.fillSelectionTo);
  const pickFormulaRange = useSpreadsheetStore((state) => state.pickFormulaRange);
  const beginEdit = useSpreadsheetStore((state) => state.beginEdit);
  const copySelection = useSpreadsheetStore((state) => state.copySelection);
  const clearSelection = useSpreadsheetStore((state) => state.clearSelection);
  const insertRowBelow = useSpreadsheetStore((state) => state.insertRowBelow);
  const insertColumnRight = useSpreadsheetStore((state) => state.insertColumnRight);
  const setColumnWidth = useSpreadsheetStore((state) => state.setColumnWidth);
  const setRowHeight = useSpreadsheetStore((state) => state.setRowHeight);
  const zoom = useSpreadsheetStore((state) => state.zoom);
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const sheet = useMemo(() => sheets.find((candidate) => candidate.id === activeSheetId) ?? sheets[0], [activeSheetId, sheets]);
  const activeFormula = sheet.cells[cellKey(selection.end)]?.formula;
  const metrics = useGridMetrics(viewport);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const totalWidth = useMemo(() => sheetPixelWidth(sheet) * zoom, [sheet, zoom]);
  const totalHeight = useMemo(() => sheetPixelHeight(sheet) * zoom, [sheet, zoom]);

  const precedents = useMemo(() => {
    if (!activeFormula) {
      return [];
    }
    return getCellPrecedents(selection.end);
  }, [activeFormula, selection.end]);

  const updateViewport = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const nextViewport = {
      width: scroller.clientWidth / zoom,
      height: scroller.clientHeight / zoom,
      scrollLeft: scroller.scrollLeft / zoom,
      scrollTop: scroller.scrollTop / zoom
    };
    setViewport((current) =>
      current.width === nextViewport.width &&
      current.height === nextViewport.height &&
      current.scrollLeft === nextViewport.scrollLeft &&
      current.scrollTop === nextViewport.scrollTop
        ? current
        : nextViewport
    );
    onViewportChange(nextViewport);
  }, [onViewportChange, zoom]);

  useLayoutEffect(() => {
    updateViewport();
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const observer = new ResizeObserver(updateViewport);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [updateViewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let animationFrame = requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = viewport.width * zoom;
      const cssHeight = viewport.height * zoom;
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
      ctx.clearRect(0, 0, viewport.width, viewport.height);
      ctx.fillStyle = sheetBackground;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      ctx.font = CELL_FONT;

      const columns = new Set<number>();
      const rows = new Set<number>();
      for (let col = metrics.visibleRange.colStart; col <= metrics.visibleRange.colEnd; col += 1) {
        columns.add(col);
      }
      for (let col = 0; col < GRID.frozenColumns; col += 1) {
        columns.add(col);
      }
      for (let row = metrics.visibleRange.rowStart; row <= metrics.visibleRange.rowEnd; row += 1) {
        rows.add(row);
      }
      for (let row = 0; row < GRID.frozenRows; row += 1) {
        rows.add(row);
      }

      const visibleColumns = Array.from(columns).sort((left, right) => left - right);
      const visibleRows = Array.from(rows).sort((left, right) => left - right);
      const paintColumns = paintOrder(visibleColumns, GRID.frozenColumns);
      const paintRows = paintOrder(visibleRows, GRID.frozenRows);

      for (const row of paintRows) {
        for (const col of paintColumns) {
          const address = { row, col };
          if (isMergeChild(sheet, address)) {
            continue;
          }

          const mergeRange = mergeRangeForCell(sheet, address);
          const rect = mergeRange ? getRangeRect(sheet, mergeRange, viewport) : getCellRect(sheet, address, viewport);
          if (
            rect.x + rect.width < GRID.rowHeaderWidth ||
            rect.y + rect.height < GRID.columnHeaderHeight ||
            rect.x > viewport.width ||
            rect.y > viewport.height
          ) {
            continue;
          }
          drawCell(ctx, sheet, address, rect.x, rect.y, rect.width, rect.height, selection, precedents);
        }
      }

      drawHeaders(ctx, sheet, viewport, visibleColumns, visibleRows);
      drawFrozenBoundaries(ctx, sheet, viewport);
      drawSelection(ctx, sheet, selection, viewport);
      if (fillPreview) {
        drawSelection(ctx, sheet, fillPreview, viewport, true);
      }
      drawResizeGuide(ctx, sheet, viewport, resizePreview);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [fillPreview, metrics.visibleRange, precedents, resizePreview, selection, sheet, viewport, zoom]);

  const cellFromPointer = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return { row: 0, col: 0 };
      }
      const rect = canvas.getBoundingClientRect();
      const address = pointToCell(sheet, (event.clientX - rect.left) / zoom, (event.clientY - rect.top) / zoom, viewport);
      return mergeRangeForCell(sheet, address)?.start ?? address;
    },
    [sheet, viewport, zoom]
  );

  const canvasPointFromPointer = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  }, [zoom]);

  const scheduleRangeSelection = useCallback(
    (range: CellRange) => {
      pendingDragRange.current = range;
      if (dragAnimationFrame.current !== null) {
        return;
      }

      dragAnimationFrame.current = window.requestAnimationFrame(() => {
        dragAnimationFrame.current = null;
        const nextRange = pendingDragRange.current;
        pendingDragRange.current = null;
        if (nextRange) {
          selectRange(nextRange);
        }
      });
    },
    [selectRange]
  );

  const scheduleFillPreview = useCallback((range: CellRange) => {
    pendingFillPreview.current = range;
    if (fillAnimationFrame.current !== null) {
      return;
    }

    fillAnimationFrame.current = window.requestAnimationFrame(() => {
      fillAnimationFrame.current = null;
      const nextRange = pendingFillPreview.current;
      pendingFillPreview.current = null;
      if (nextRange) {
        setFillPreview(nextRange);
      }
    });
  }, []);

  const formulaRangePicking = Boolean(editMode?.currentValue.startsWith("="));
  const cursor = resizePreview
    ? resizePreview.kind === "column"
      ? "col-resize"
      : "row-resize"
    : resizeHover === "column"
      ? "col-resize"
      : resizeHover === "row"
        ? "row-resize"
        : fillHandleHover
          ? fillHandleCursor
          : undefined;

  useEffect(() => {
    return () => {
      if (dragAnimationFrame.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrame.current);
      }
      if (fillAnimationFrame.current !== null) {
        window.cancelAnimationFrame(fillAnimationFrame.current);
      }
    };
  }, []);

  return (
    <div
      ref={scrollerRef}
      onScroll={updateViewport}
      className="relative min-h-0 flex-1 overflow-auto bg-white"
      style={{
        backgroundColor: sheetBackground,
        backgroundImage: `linear-gradient(${sheetGridLine} 1px, transparent 1px), linear-gradient(90deg, ${sheetGridLine} 1px, transparent 1px)`,
        backgroundPosition: `${(GRID.rowHeaderWidth - (viewport.scrollLeft % GRID.columnWidth)) * zoom}px ${
          (GRID.columnHeaderHeight - (viewport.scrollTop % GRID.rowHeight)) * zoom
        }px`,
        backgroundSize: `${GRID.columnWidth * zoom}px ${GRID.rowHeight * zoom}px`
      }}
    >
      <canvas
        ref={canvasRef}
        role="grid"
        aria-label={`Spreadsheet grid, selected ${addressLabel(selection.end)}`}
        tabIndex={0}
        className="sticky left-0 top-0 z-10 cursor-cell bg-white outline-none"
        style={{ cursor }}
        onPointerDown={(event) => {
          setContextMenu(null);
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = canvasPointFromPointer(event);
          const headerResizeHit = findResizeHit(sheet, point.x, point.y, viewport);
          const resizeHit =
            headerResizeHit ?? findSelectionResizeHit(sheet, point.x, point.y, selection, viewport);
          if (resizeHit) {
            event.preventDefault();
            const startSize =
              resizeHit.kind === "column" ? columnWidth(sheet, resizeHit.index) : rowHeight(sheet, resizeHit.index);
            const nextResize = {
              ...resizeHit,
              startClient: resizeHit.kind === "column" ? event.clientX : event.clientY,
              startSize,
              currentSize: startSize
            };
            resizeDrag.current = nextResize;
            setResizePreview(nextResize);
            return;
          }
          if (formulaRangePicking) {
            event.preventDefault();
            const address = cellFromPointer(event);
            pointerStart.current = address;
            pickFormulaRange({ start: address, end: address });
            return;
          }
          if (isPointOnFillHandle(point.x, point.y, sheet, selection, viewport)) {
            fillDragStart.current = normalizeRange(selection);
            setFillPreview(normalizeRange(selection));
            return;
          }
          const address = cellFromPointer(event);
          pointerStart.current = address;
          selectCell(address, event.shiftKey);
        }}
        onPointerMove={(event) => {
          if (resizeDrag.current && event.buttons === 1) {
            event.preventDefault();
            const activeResize = resizeDrag.current;
            const delta =
              activeResize.kind === "column"
                ? (event.clientX - activeResize.startClient) / zoom
                : (event.clientY - activeResize.startClient) / zoom;
            const currentSize =
              activeResize.kind === "column"
                ? clampColumnWidth(activeResize.startSize + delta)
                : clampRowHeight(activeResize.startSize + delta);
            const nextResize = { ...activeResize, currentSize };
            resizeDrag.current = nextResize;
            setResizePreview(nextResize);
            return;
          }
          if (formulaRangePicking && pointerStart.current && event.buttons === 1) {
            event.preventDefault();
            pickFormulaRange({ start: pointerStart.current, end: cellFromPointer(event) });
            return;
          }
          if (fillDragStart.current && event.buttons === 1) {
            const target = cellFromPointer(event);
            const sourceRange = fillDragStart.current;
            scheduleFillPreview(
              normalizeRange({
                start: {
                  row: Math.min(sourceRange.start.row, target.row),
                  col: Math.min(sourceRange.start.col, target.col)
                },
                end: {
                  row: Math.max(sourceRange.end.row, target.row),
                  col: Math.max(sourceRange.end.col, target.col)
                }
              })
            );
            return;
          }
          if (event.buttons !== 1) {
            const point = canvasPointFromPointer(event);
            const headerResizeHit = findResizeHit(sheet, point.x, point.y, viewport);
            const onFillHandle = isPointOnFillHandle(point.x, point.y, sheet, selection, viewport);
            const resizeHit = headerResizeHit ?? (onFillHandle ? null : findSelectionResizeHit(sheet, point.x, point.y, selection, viewport));
            setResizeHover(resizeHit?.kind ?? null);
            setFillHandleHover(!resizeHit && onFillHandle);
            return;
          }
          if (!pointerStart.current || event.buttons !== 1) {
            return;
          }
          scheduleRangeSelection({ start: pointerStart.current, end: cellFromPointer(event) });
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          if (resizeDrag.current) {
            const activeResize = resizeDrag.current;
            if (activeResize.kind === "column") {
              setColumnWidth(activeResize.index, activeResize.currentSize);
            } else {
              setRowHeight(activeResize.index, activeResize.currentSize);
            }
            resizeDrag.current = null;
            setResizePreview(null);
            setResizeHover(null);
            return;
          }
          if (formulaRangePicking && pointerStart.current) {
            event.preventDefault();
            pickFormulaRange({ start: pointerStart.current, end: cellFromPointer(event) });
            pointerStart.current = null;
            return;
          }
          if (fillDragStart.current) {
            fillSelectionTo(cellFromPointer(event));
            fillDragStart.current = null;
            setFillPreview(null);
            return;
          }
          pointerStart.current = null;
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          const address = cellFromPointer(event);
          selectCell(address);
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
        onDoubleClick={(event) => beginEdit(cellFromPointer(event))}
      />
      {contextMenu ? (
        <div
          className="fixed z-40 w-52 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-green-50"
            onClick={async () => {
              await navigator.clipboard.writeText(copySelection());
              setContextMenu(null);
            }}
          >
            <Copy className="h-4 w-4" />
            Copy
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-green-50"
            onClick={() => {
              insertRowBelow();
              setContextMenu(null);
            }}
          >
            <Rows3 className="h-4 w-4" />
            Insert row below
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-green-50"
            onClick={() => {
              insertColumnRight();
              setContextMenu(null);
            }}
          >
            <Columns3 className="h-4 w-4" />
            Insert column right
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
            onClick={() => {
              clearSelection();
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Clear contents
          </button>
        </div>
      ) : null}
      <div style={{ width: totalWidth, height: totalHeight }} aria-hidden="true" />
    </div>
  );
}
