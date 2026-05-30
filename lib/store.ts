"use client";

import { create } from "zustand";
import type { CellAddress, CellData, CellRange, CellStyle, SelectionStats, Sheet } from "./grid";
import {
  GRID,
  cellKey,
  clampAddress,
  clampColumnWidth,
  clampRowHeight,
  createEmptyCell,
  formatNumber,
  formulaWithRangeReference,
  inferCellData,
  isCellInRange,
  normalizeRange,
  offsetFormulaReferences
} from "./grid";
import { recalculateSheet } from "./hyperformula";

type EditMode = {
  address: CellAddress;
  initialValue: string;
  currentValue: string;
  pickingFormulaRange: boolean;
} | null;

type WorkbookSnapshot = {
  sheets: Sheet[];
  activeSheetId: string;
  selection: CellRange;
};

type SpreadsheetState = {
  workbookId: string;
  sheets: Sheet[];
  activeSheetId: string;
  selection: CellRange;
  editMode: EditMode;
  clipboard: string;
  commandPaletteOpen: boolean;
  dirty: boolean;
  undoStack: WorkbookSnapshot[];
  redoStack: WorkbookSnapshot[];
  setWorkbookId: (workbookId: string) => void;
  getActiveSheet: () => Sheet;
  getCell: (address: CellAddress) => CellData;
  selectCell: (address: CellAddress, extending?: boolean) => void;
  selectRange: (range: CellRange) => void;
  selectAll: () => void;
  setCellInput: (address: CellAddress, input: string) => void;
  setEditInput: (input: string) => void;
  pickFormulaRange: (range: CellRange) => void;
  applyStyle: (style: CellStyle) => void;
  applyNumberFormat: (format: "plain" | "currency" | "percent" | "decimal") => void;
  clearSelection: () => void;
  insertRowBelow: () => void;
  insertColumnRight: () => void;
  setColumnWidth: (col: number, width: number) => void;
  setRowHeight: (row: number, height: number) => void;
  fillSelectionTo: (target: CellAddress) => void;
  replaceAll: (findText: string, replaceText: string) => number;
  importRows: (rows: string[][], sheetName: string) => void;
  exportActiveSheetCsv: () => string;
  beginEdit: (address: CellAddress, initialValue?: string) => void;
  commitEdit: (input: string, move?: CellAddress) => void;
  cancelEdit: () => void;
  moveSelection: (delta: CellAddress, extending?: boolean) => void;
  copySelection: () => string;
  pasteAtSelection: (text: string) => void;
  undo: () => void;
  redo: () => void;
  addSheet: () => void;
  renameSheet: (sheetId: string, name: string) => void;
  deleteSheet: (sheetId: string) => void;
  setActiveSheet: (sheetId: string) => void;
  toggleCommandPalette: (open?: boolean) => void;
  markSaved: () => void;
  selectionStats: () => SelectionStats;
};

const firstSelection: CellRange = {
  start: { row: 0, col: 0 },
  end: { row: 0, col: 0 }
};

function createInitialSheet(): Sheet {
  const cells: Record<string, CellData> = {
    [cellKey({ row: 0, col: 0 })]: inferCellData("Revenue"),
    [cellKey({ row: 0, col: 1 })]: inferCellData("Q1"),
    [cellKey({ row: 0, col: 2 })]: inferCellData("Q2"),
    [cellKey({ row: 1, col: 0 })]: inferCellData("Product"),
    [cellKey({ row: 1, col: 1 })]: inferCellData("$125000"),
    [cellKey({ row: 1, col: 2 })]: inferCellData("$154000"),
    [cellKey({ row: 2, col: 0 })]: inferCellData("Services"),
    [cellKey({ row: 2, col: 1 })]: inferCellData("$86000"),
    [cellKey({ row: 2, col: 2 })]: inferCellData("$97000"),
    [cellKey({ row: 4, col: 0 })]: inferCellData("Total"),
    [cellKey({ row: 4, col: 1 })]: inferCellData("=SUM(B2:B3)"),
    [cellKey({ row: 4, col: 2 })]: inferCellData("=SUM(C2:C3)")
  };

  return recalculateSheet({
    id: "sheet-1",
    name: "Sheet 1",
    cells,
    rowHeights: {},
    columnWidths: {}
  });
}

function snapshot(state: SpreadsheetState): WorkbookSnapshot {
  return {
    sheets: state.sheets,
    activeSheetId: state.activeSheetId,
    selection: state.selection
  };
}

function activeSheetFromState(state: SpreadsheetState): Sheet {
  return state.sheets.find((sheet) => sheet.id === state.activeSheetId) ?? state.sheets[0];
}

function updateActiveSheet(state: SpreadsheetState, updater: (sheet: Sheet) => Sheet): Partial<SpreadsheetState> {
  const undoStack = [snapshot(state), ...state.undoStack].slice(0, 50);
  const activeSheetId = state.activeSheetId;
  const sheets = state.sheets.map((sheet) => (sheet.id === activeSheetId ? updater(sheet) : sheet));

  return {
    sheets,
    undoStack,
    redoStack: [],
    dirty: true
  };
}

function isEntireGridSelection(range: CellRange): boolean {
  const normalized = normalizeRange(range);
  return (
    normalized.start.row === 0 &&
    normalized.start.col === 0 &&
    normalized.end.row === GRID.rowCount - 1 &&
    normalized.end.col === GRID.columnCount - 1
  );
}

function keyToAddress(key: string): CellAddress | null {
  const [rowPart, colPart] = key.split(":");
  const row = Number.parseInt(rowPart, 10);
  const col = Number.parseInt(colPart, 10);
  return Number.isFinite(row) && Number.isFinite(col) ? { row, col } : null;
}

export const useSpreadsheetStore = create<SpreadsheetState>((set, get) => ({
  workbookId: "local",
  sheets: [createInitialSheet()],
  activeSheetId: "sheet-1",
  selection: firstSelection,
  editMode: null,
  clipboard: "",
  commandPaletteOpen: false,
  dirty: false,
  undoStack: [],
  redoStack: [],
  setWorkbookId: (workbookId) => set({ workbookId }),
  getActiveSheet: () => activeSheetFromState(get()),
  getCell: (address) => {
    const sheet = activeSheetFromState(get());
    return sheet.cells[cellKey(address)] ?? createEmptyCell();
  },
  selectCell: (address, extending = false) => {
    const clamped = clampAddress(address);
    const current = get().selection;
    set({
      selection: extending ? { start: current.start, end: clamped } : { start: clamped, end: clamped }
    });
  },
  selectRange: (range) => set({ selection: normalizeRange(range) }),
  selectAll: () =>
    set({
      selection: {
        start: { row: 0, col: 0 },
        end: { row: GRID.rowCount - 1, col: GRID.columnCount - 1 }
      }
    }),
  setCellInput: (address, input) => {
    const cell = inferCellData(input);
    set((state) =>
      updateActiveSheet(state, (sheet) =>
        recalculateSheet({
          ...sheet,
          cells: {
            ...sheet.cells,
            [cellKey(address)]: {
              ...cell,
              style: sheet.cells[cellKey(address)]?.style ?? {}
            }
          }
        })
      )
    );
  },
  setEditInput: (input) => {
    set((state) => ({
      editMode: state.editMode ? { ...state.editMode, currentValue: input } : state.editMode
    }));
  },
  pickFormulaRange: (range) => {
    set((state) => {
      if (!state.editMode || !state.editMode.currentValue.startsWith("=")) {
        return { selection: normalizeRange(range) };
      }

      const normalized = normalizeRange(range);
      return {
        selection: normalized,
        editMode: {
          ...state.editMode,
          currentValue: formulaWithRangeReference(state.editMode.currentValue, normalized),
          pickingFormulaRange: true
        }
      };
    });
  },
  applyStyle: (style) => {
    set((state) =>
      updateActiveSheet(state, (sheet) => {
        const range = normalizeRange(state.selection);
        const cells = { ...sheet.cells };
        const entries = isEntireGridSelection(range) ? Object.entries(cells) : null;

        if (entries) {
          for (const [key, existing] of entries) {
            cells[key] = { ...existing, style: { ...existing.style, ...style } };
          }
        } else {
          for (let row = range.start.row; row <= range.end.row; row += 1) {
            for (let col = range.start.col; col <= range.end.col; col += 1) {
              const key = cellKey({ row, col });
              const existing = cells[key] ?? createEmptyCell();
              cells[key] = {
                ...existing,
                style: { ...existing.style, ...style }
              };
            }
          }
        }

        return { ...sheet, cells };
      })
    );
  },
  applyNumberFormat: (format) => {
    set((state) =>
      updateActiveSheet(state, (sheet) => {
        const range = normalizeRange(state.selection);
        const cells = { ...sheet.cells };
        const addresses = isEntireGridSelection(range)
          ? Object.keys(cells).flatMap((key) => {
              const address = keyToAddress(key);
              return address ? [address] : [];
            })
          : null;

        const applyFormat = (row: number, col: number) => {
          const key = cellKey({ row, col });
          const existing = cells[key] ?? createEmptyCell();
          const numericValue =
            typeof existing.value === "number"
              ? existing.value
              : Number.parseFloat(String(existing.displayValue).replace(/[$,%]/g, ""));

          cells[key] = {
            ...existing,
            value: Number.isFinite(numericValue) ? numericValue : existing.value,
            displayValue: Number.isFinite(numericValue) ? formatNumber(numericValue, format) : existing.displayValue,
            format: {
              kind: format === "currency" ? "currency" : "number",
              numberFormat: format
            }
          };
        };

        if (addresses) {
          for (const address of addresses) {
            applyFormat(address.row, address.col);
          }
        } else {
          for (let row = range.start.row; row <= range.end.row; row += 1) {
            for (let col = range.start.col; col <= range.end.col; col += 1) {
              applyFormat(row, col);
            }
          }
        }

        return { ...sheet, cells };
      })
    );
  },
  clearSelection: () => {
    set((state) =>
      updateActiveSheet(state, (sheet) => {
        const range = normalizeRange(state.selection);
        if (isEntireGridSelection(range)) {
          return recalculateSheet({ ...sheet, cells: {} });
        }

        const cells = { ...sheet.cells };

        for (let row = range.start.row; row <= range.end.row; row += 1) {
          for (let col = range.start.col; col <= range.end.col; col += 1) {
            delete cells[cellKey({ row, col })];
          }
        }

        return recalculateSheet({ ...sheet, cells });
      })
    );
  },
  insertRowBelow: () => {
    set((state) =>
      updateActiveSheet(state, (sheet) => {
        const insertAt = normalizeRange(state.selection).end.row + 1;
        const cells: Sheet["cells"] = {};

        for (const [key, cell] of Object.entries(sheet.cells)) {
          const [rowPart, colPart] = key.split(":");
          const row = Number.parseInt(rowPart, 10);
          const col = Number.parseInt(colPart, 10);
          cells[cellKey({ row: row >= insertAt ? row + 1 : row, col })] = cell;
        }

        return recalculateSheet({ ...sheet, cells });
      })
    );
  },
  insertColumnRight: () => {
    set((state) =>
      updateActiveSheet(state, (sheet) => {
        const insertAt = normalizeRange(state.selection).end.col + 1;
        const cells: Sheet["cells"] = {};

        for (const [key, cell] of Object.entries(sheet.cells)) {
          const [rowPart, colPart] = key.split(":");
          const row = Number.parseInt(rowPart, 10);
          const col = Number.parseInt(colPart, 10);
          cells[cellKey({ row, col: col >= insertAt ? col + 1 : col })] = cell;
        }

        return recalculateSheet({ ...sheet, cells });
      })
    );
  },
  setColumnWidth: (col, width) => {
    const clampedWidth = clampColumnWidth(width);
    set((state) =>
      updateActiveSheet(state, (sheet) => ({
        ...sheet,
        columnWidths: {
          ...sheet.columnWidths,
          [clampAddress({ row: 0, col }).col]: clampedWidth
        }
      }))
    );
  },
  setRowHeight: (row, height) => {
    const clampedHeight = clampRowHeight(height);
    set((state) =>
      updateActiveSheet(state, (sheet) => ({
        ...sheet,
        rowHeights: {
          ...sheet.rowHeights,
          [clampAddress({ row, col: 0 }).row]: clampedHeight
        }
      }))
    );
  },
  fillSelectionTo: (target) => {
    const clampedTarget = clampAddress(target);
    const sourceRange = normalizeRange(get().selection);
    const targetRange = normalizeRange({
      start: {
        row: Math.min(sourceRange.start.row, clampedTarget.row),
        col: Math.min(sourceRange.start.col, clampedTarget.col)
      },
      end: {
        row: Math.max(sourceRange.end.row, clampedTarget.row),
        col: Math.max(sourceRange.end.col, clampedTarget.col)
      }
    });
    const sourceHeight = sourceRange.end.row - sourceRange.start.row + 1;
    const sourceWidth = sourceRange.end.col - sourceRange.start.col + 1;
    const activeSheet = activeSheetFromState(get());
    const verticalSeriesByColumn = Array.from({ length: sourceWidth }, (_, colOffset) => {
      const values = Array.from({ length: sourceHeight }, (_, rowOffset) => {
        const value =
          activeSheet.cells[cellKey({ row: sourceRange.start.row + rowOffset, col: sourceRange.start.col + colOffset })]
            ?.value;
        return typeof value === "number" ? value : null;
      });

      return sourceHeight >= 2 && values.every((value) => value !== null)
        ? { first: values[0] as number, second: values[1] as number }
        : null;
    });
    const horizontalSeriesByRow = Array.from({ length: sourceHeight }, (_, rowOffset) => {
      const values = Array.from({ length: sourceWidth }, (_, colOffset) => {
        const value =
          activeSheet.cells[cellKey({ row: sourceRange.start.row + rowOffset, col: sourceRange.start.col + colOffset })]
            ?.value;
        return typeof value === "number" ? value : null;
      });

      return sourceWidth >= 2 && values.every((value) => value !== null)
        ? { first: values[0] as number, second: values[1] as number }
        : null;
    });

    set((state) =>
      updateActiveSheet(state, (sheet) => {
        const cells = { ...sheet.cells };
        const wrap = (value: number, size: number) => ((value % size) + size) % size;

        for (let row = targetRange.start.row; row <= targetRange.end.row; row += 1) {
          for (let col = targetRange.start.col; col <= targetRange.end.col; col += 1) {
            if (
              row >= sourceRange.start.row &&
              row <= sourceRange.end.row &&
              col >= sourceRange.start.col &&
              col <= sourceRange.end.col
            ) {
              continue;
            }

            const sourceRow = sourceRange.start.row + wrap(row - sourceRange.start.row, sourceHeight);
            const sourceCol = sourceRange.start.col + wrap(col - sourceRange.start.col, sourceWidth);
            const sourceCell = sheet.cells[cellKey({ row: sourceRow, col: sourceCol })];
            if (!sourceCell) {
              continue;
            }

            let input = sourceCell.formula ?? sourceCell.displayValue;
            if (sourceCell.formula) {
              input = offsetFormulaReferences(sourceCell.formula, row - sourceRow, col - sourceCol);
            } else if (row < sourceRange.start.row || row > sourceRange.end.row) {
              const series = verticalSeriesByColumn[sourceCol - sourceRange.start.col];
              if (series) {
                input = String(series.first + (series.second - series.first) * (row - sourceRange.start.row));
              }
            } else if (col < sourceRange.start.col || col > sourceRange.end.col) {
              const series = horizontalSeriesByRow[sourceRow - sourceRange.start.row];
              if (series) {
                input = String(series.first + (series.second - series.first) * (col - sourceRange.start.col));
              }
            }

            cells[cellKey({ row, col })] = {
              ...inferCellData(input),
              style: sourceCell.style
            };
          }
        }

        return recalculateSheet({ ...sheet, cells });
      })
    );
    get().selectRange(targetRange);
  },
  replaceAll: (findText, replaceText) => {
    const needle = findText.trim();
    if (!needle) {
      return 0;
    }

    let replaced = 0;
    set((state) =>
      updateActiveSheet(state, (sheet) => {
        const cells: Sheet["cells"] = {};

        for (const [key, cell] of Object.entries(sheet.cells)) {
          const source = cell.formula ?? cell.displayValue;
          if (source.includes(needle)) {
            replaced += 1;
            const nextCell = inferCellData(source.replaceAll(needle, replaceText));
            cells[key] = {
              ...nextCell,
              style: cell.style
            };
          } else {
            cells[key] = cell;
          }
        }

        return recalculateSheet({ ...sheet, cells });
      })
    );

    return replaced;
  },
  importRows: (rows, sheetName) => {
    set((state) =>
      updateActiveSheet(state, (sheet) => {
        const cells: Sheet["cells"] = {};

        rows.forEach((row, rowIndex) => {
          row.forEach((value, colIndex) => {
            if (value.trim().length === 0) {
              return;
            }
            cells[cellKey({ row: rowIndex, col: colIndex })] = inferCellData(value);
          });
        });

        return recalculateSheet({
          ...sheet,
          name: sheetName.trim() || sheet.name,
          cells
        });
      })
    );
  },
  exportActiveSheetCsv: () => {
    const sheet = activeSheetFromState(get());
    const addresses = Object.keys(sheet.cells).map((key) => {
      const [rowPart, colPart] = key.split(":");
      return {
        row: Number.parseInt(rowPart, 10),
        col: Number.parseInt(colPart, 10)
      };
    });
    const maxRow = Math.max(0, ...addresses.map((address) => address.row));
    const maxCol = Math.max(0, ...addresses.map((address) => address.col));
    const rows: string[] = [];

    for (let row = 0; row <= maxRow; row += 1) {
      const values: string[] = [];
      for (let col = 0; col <= maxCol; col += 1) {
        const cell = sheet.cells[cellKey({ row, col })];
        const value = cell?.formula ?? cell?.displayValue ?? "";
        values.push(`"${value.replaceAll('"', '""')}"`);
      }
      rows.push(values.join(","));
    }

    return rows.join("\n");
  },
  beginEdit: (address, initialValue) => {
    const cell = get().getCell(address);
    const value = initialValue ?? cell.formula ?? cell.displayValue;
    set({
      editMode: {
        address,
        initialValue: value,
        currentValue: value,
        pickingFormulaRange: false
      }
    });
  },
  commitEdit: (input, move) => {
    const editMode = get().editMode;
    if (!editMode) {
      return;
    }

    get().setCellInput(editMode.address, input);
    set({ editMode: null });
    if (move) {
      get().selectCell(move);
    }
  },
  cancelEdit: () => set({ editMode: null }),
  moveSelection: (delta, extending = false) => {
    const current = get().selection.end;
    get().selectCell({ row: current.row + delta.row, col: current.col + delta.col }, extending);
  },
  copySelection: () => {
    const state = get();
    const sheet = activeSheetFromState(state);
    const range = normalizeRange(state.selection);
    const copyRange = isEntireGridSelection(range)
      ? Object.keys(sheet.cells).reduce<CellRange>(
          (usedRange, key) => {
            const address = keyToAddress(key);
            if (!address) {
              return usedRange;
            }
            return {
              start: {
                row: Math.min(usedRange.start.row, address.row),
                col: Math.min(usedRange.start.col, address.col)
              },
              end: {
                row: Math.max(usedRange.end.row, address.row),
                col: Math.max(usedRange.end.col, address.col)
              }
            };
          },
          { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
        )
      : range;
    const rows: string[] = [];

    for (let row = copyRange.start.row; row <= copyRange.end.row; row += 1) {
      const values: string[] = [];
      for (let col = copyRange.start.col; col <= copyRange.end.col; col += 1) {
        const cell = sheet.cells[cellKey({ row, col })];
        values.push(cell?.formula ?? cell?.displayValue ?? "");
      }
      rows.push(values.join("\t"));
    }

    const text = rows.join("\n");
    set({ clipboard: text });
    return text;
  },
  pasteAtSelection: (text) => {
    const origin = get().selection.start;
    const rows = text.split(/\r?\n/).filter((row) => row.length > 0);

    set((state) =>
      updateActiveSheet(state, (sheet) => {
        const cells = { ...sheet.cells };
        rows.forEach((rowText, rowOffset) => {
          rowText.split("\t").forEach((value, colOffset) => {
            const address = clampAddress({ row: origin.row + rowOffset, col: origin.col + colOffset });
            cells[cellKey(address)] = {
              ...inferCellData(value),
              style: sheet.cells[cellKey(address)]?.style ?? {}
            };
          });
        });
        return recalculateSheet({ ...sheet, cells });
      })
    );
  },
  undo: () => {
    const state = get();
    const [previous, ...rest] = state.undoStack;
    if (!previous) {
      return;
    }
    set({
      ...previous,
      undoStack: rest,
      redoStack: [snapshot(state), ...state.redoStack].slice(0, 50),
      dirty: true
    });
  },
  redo: () => {
    const state = get();
    const [next, ...rest] = state.redoStack;
    if (!next) {
      return;
    }
    set({
      ...next,
      redoStack: rest,
      undoStack: [snapshot(state), ...state.undoStack].slice(0, 50),
      dirty: true
    });
  },
  addSheet: () => {
    set((state) => {
      const id = `sheet-${state.sheets.length + 1}`;
      return {
        sheets: [
          ...state.sheets,
          {
            id,
            name: `Sheet ${state.sheets.length + 1}`,
            cells: {},
            rowHeights: {},
            columnWidths: {}
          }
        ],
        activeSheetId: id,
        dirty: true
      };
    });
  },
  renameSheet: (sheetId, name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    set((state) => ({
      sheets: state.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, name: trimmed } : sheet)),
      dirty: true
    }));
  },
  deleteSheet: (sheetId) => {
    set((state) => {
      if (state.sheets.length === 1) {
        return state;
      }
      const sheets = state.sheets.filter((sheet) => sheet.id !== sheetId);
      return {
        sheets,
        activeSheetId: state.activeSheetId === sheetId ? sheets[0].id : state.activeSheetId,
        dirty: true
      };
    });
  },
  setActiveSheet: (sheetId) => set({ activeSheetId: sheetId, selection: firstSelection }),
  toggleCommandPalette: (open) => set((state) => ({ commandPaletteOpen: open ?? !state.commandPaletteOpen })),
  markSaved: () => set({ dirty: false }),
  selectionStats: () => {
    const state = get();
    const sheet = activeSheetFromState(state);
    const range = normalizeRange(state.selection);
    let sum = 0;
    let count = 0;
    let min: number | null = null;
    let max: number | null = null;

    for (const [key, cell] of Object.entries(sheet.cells)) {
      const address = keyToAddress(key);
      if (!address || !isCellInRange(address, range)) {
        continue;
      }

      const value = cell.value;
        if (typeof value === "number" && Number.isFinite(value)) {
          sum += value;
          count += 1;
          min = min === null ? value : Math.min(min, value);
          max = max === null ? value : Math.max(max, value);
        }
    }

    return {
      sum,
      average: count === 0 ? 0 : sum / count,
      count,
      min,
      max
    };
  }
}));
