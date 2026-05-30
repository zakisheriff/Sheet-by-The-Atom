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
const fillHandleCursor =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27%3E%3Cpath d=%27M12 2v20M2 12h20%27 stroke=%27%23000%27 stroke-width=%273%27 stroke-linecap=%27square%27/%3E%3Cpath d=%27M12 5v14M5 12h14%27 stroke=%27%23fff%27 stroke-width=%271%27 stroke-linecap=%27square%27/%3E%3C/svg%3E") 12 12, crosshair';

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

  return {
    x: GRID.rowHeaderWidth + columnOffset(sheet, address.col) - (isFrozenCol ? 0 : viewport.scrollLeft),
    y: GRID.columnHeaderHeight + rowOffset(sheet, address.row) - (isFrozenRow ? 0 : viewport.scrollTop),
    width,
    height,
    isFrozenCol,
    isFrozenRow
  };
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
  if (cell?.style.fillColor) {
    ctx.fillStyle = cell.style.fillColor;
    ctx.fillRect(x, y, width, height);
  }

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
}

function drawHeaders(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  viewport: Viewport,
  visibleColumns: number[],
  visibleRows: number[]
) {
  ctx.save();
  ctx.font = "500 12px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FAFAFA";
  ctx.fillRect(0, 0, viewport.width, GRID.columnHeaderHeight);
  ctx.fillRect(0, 0, GRID.rowHeaderWidth, viewport.height);
  ctx.strokeStyle = "#D4D4D4";

  for (const col of visibleColumns) {
    const isFrozen = col < GRID.frozenColumns;
    const width = columnWidth(sheet, col);
    const x = GRID.rowHeaderWidth + columnOffset(sheet, col) - (isFrozen ? 0 : viewport.scrollLeft);
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(x, 0, width, GRID.columnHeaderHeight);
    ctx.strokeRect(x + 0.5, 0.5, width, GRID.columnHeaderHeight);
    ctx.fillStyle = "#525252";
    ctx.fillText(columnName(col), x + width / 2, GRID.columnHeaderHeight / 2);
  }

  for (const row of visibleRows) {
    const isFrozen = row < GRID.frozenRows;
    const height = rowHeight(sheet, row);
    const y = GRID.columnHeaderHeight + rowOffset(sheet, row) - (isFrozen ? 0 : viewport.scrollTop);
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, y, GRID.rowHeaderWidth, height);
    ctx.strokeRect(0.5, y + 0.5, GRID.rowHeaderWidth, height);
    ctx.fillStyle = "#525252";
    ctx.fillText(String(row + 1), GRID.rowHeaderWidth / 2, y + height / 2);
  }

  ctx.fillStyle = "#FAFAFA";
  ctx.fillRect(0, 0, GRID.rowHeaderWidth, GRID.columnHeaderHeight);
  ctx.strokeRect(0.5, 0.5, GRID.rowHeaderWidth, GRID.columnHeaderHeight);
  ctx.restore();
}

function getSelectionBounds(sheet: Sheet, selection: CellRange, viewport: Viewport) {
  const range = normalizeRange(selection);
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
    const offset = x - GRID.rowHeaderWidth + (x <= GRID.rowHeaderWidth + GRID.frozenColumns * GRID.columnWidth ? 0 : viewport.scrollLeft);
    const col = columnAtOffset(sheet, offset);
    const boundary = GRID.rowHeaderWidth + columnOffset(sheet, col) + columnWidth(sheet, col) - (col < GRID.frozenColumns ? 0 : viewport.scrollLeft);
    if (Math.abs(x - boundary) <= resizeHitSize) {
      return { kind: "column", index: col };
    }
  }

  if (x >= 0 && x <= GRID.rowHeaderWidth && y > GRID.columnHeaderHeight) {
    const offset = y - GRID.columnHeaderHeight + (y <= GRID.columnHeaderHeight + GRID.frozenRows * GRID.rowHeight ? 0 : viewport.scrollTop);
    const row = rowAtOffset(sheet, offset);
    const boundary = GRID.columnHeaderHeight + rowOffset(sheet, row) + rowHeight(sheet, row) - (row < GRID.frozenRows ? 0 : viewport.scrollTop);
    if (Math.abs(y - boundary) <= resizeHitSize) {
      return { kind: "row", index: row };
    }
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
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const sheet = useMemo(() => sheets.find((candidate) => candidate.id === activeSheetId) ?? sheets[0], [activeSheetId, sheets]);
  const activeFormula = sheet.cells[cellKey(selection.end)]?.formula;
  const metrics = useGridMetrics(viewport);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const totalWidth = useMemo(() => sheetPixelWidth(sheet), [sheet]);
  const totalHeight = useMemo(() => sheetPixelHeight(sheet), [sheet]);

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
      width: scroller.clientWidth,
      height: scroller.clientHeight,
      scrollLeft: scroller.scrollLeft,
      scrollTop: scroller.scrollTop
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
  }, [onViewportChange]);

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
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewport.width, viewport.height);
      ctx.fillStyle = "#FFFFFF";
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

      for (const row of visibleRows) {
        for (const col of visibleColumns) {
          const rect = getCellRect(sheet, { row, col }, viewport);
          if (
            rect.x + rect.width < GRID.rowHeaderWidth ||
            rect.y + rect.height < GRID.columnHeaderHeight ||
            rect.x > viewport.width ||
            rect.y > viewport.height
          ) {
            continue;
          }
          drawCell(ctx, sheet, { row, col }, rect.x, rect.y, rect.width, rect.height, selection, precedents);
        }
      }

      drawHeaders(ctx, sheet, viewport, visibleColumns, visibleRows);
      drawSelection(ctx, sheet, selection, viewport);
      if (fillPreview) {
        drawSelection(ctx, sheet, fillPreview, viewport, true);
      }
      drawResizeGuide(ctx, sheet, viewport, resizePreview);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [fillPreview, metrics.visibleRange, precedents, resizePreview, selection, sheet, viewport]);

  const cellFromPointer = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return { row: 0, col: 0 };
      }
      const rect = canvas.getBoundingClientRect();
      return pointToCell(sheet, event.clientX - rect.left, event.clientY - rect.top, viewport);
    },
    [sheet, viewport]
  );

  const canvasPointFromPointer = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

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
      style={{}}
    >
      <canvas
        ref={canvasRef}
        role="grid"
        aria-label={`Spreadsheet grid, selected ${addressLabel(selection.end)}`}
        tabIndex={0}
        className="sticky left-0 top-0 z-10 cursor-cell outline-none"
        style={{ cursor }}
        onPointerDown={(event) => {
          setContextMenu(null);
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = canvasPointFromPointer(event);
          const resizeHit = findResizeHit(sheet, point.x, point.y, viewport);
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
                ? event.clientX - activeResize.startClient
                : event.clientY - activeResize.startClient;
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
            const resizeHit = findResizeHit(sheet, point.x, point.y, viewport);
            setResizeHover(resizeHit?.kind ?? null);
            setFillHandleHover(!resizeHit && isPointOnFillHandle(point.x, point.y, sheet, selection, viewport));
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
