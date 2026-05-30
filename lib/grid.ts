export const GRID = {
  rowHeight: 28,
  columnWidth: 112,
  minRowHeight: 20,
  minColumnWidth: 48,
  maxRowHeight: 240,
  maxColumnWidth: 480,
  rowHeaderWidth: 52,
  columnHeaderHeight: 28,
  frozenRows: 1,
  frozenColumns: 1,
  rowCount: 1_000_000,
  columnCount: 18_278
} as const;

export const CELL_FONT = "12px SFMono-Regular, Consolas, Liberation Mono, monospace";

export type CellPrimitive = string | number | boolean | Date | null;

export type CellKind = "text" | "number" | "formula" | "date" | "boolean" | "currency";

export type CellFormat = {
  kind: CellKind;
  numberFormat?: "plain" | "currency" | "percent" | "decimal";
  currencySymbol?: string;
};

export type CellStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  fillColor?: string;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  fontFamily?: string;
  fontSize?: number;
  borders?: Partial<Record<"top" | "right" | "bottom" | "left", { color: string; width: number }>>;
};

export type CellAddress = {
  row: number;
  col: number;
};

export type CellRange = {
  start: CellAddress;
  end: CellAddress;
};

export type CellData = {
  value: CellPrimitive;
  displayValue: string;
  formula?: string;
  format: CellFormat;
  style: CellStyle;
  error?: string;
};

export type Sheet = {
  id: string;
  name: string;
  cells: Record<string, CellData>;
  rowHeights: Record<number, number>;
  columnWidths: Record<number, number>;
  mergedCells: CellRange[];
};

export type SelectionStats = {
  sum: number;
  average: number;
  count: number;
  min: number | null;
  max: number | null;
};

export function columnWidth(sheet: Sheet, col: number): number {
  return sheet.columnWidths[col] ?? GRID.columnWidth;
}

export function rowHeight(sheet: Sheet, row: number): number {
  return sheet.rowHeights[row] ?? GRID.rowHeight;
}

export function clampColumnWidth(width: number): number {
  return Math.min(Math.max(Math.round(width), GRID.minColumnWidth), GRID.maxColumnWidth);
}

export function clampRowHeight(height: number): number {
  return Math.min(Math.max(Math.round(height), GRID.minRowHeight), GRID.maxRowHeight);
}

export function columnOffset(sheet: Sheet, col: number): number {
  let offset = col * GRID.columnWidth;
  for (const [key, width] of Object.entries(sheet.columnWidths)) {
    const index = Number.parseInt(key, 10);
    if (Number.isFinite(index) && index >= 0 && index < col) {
      offset += width - GRID.columnWidth;
    }
  }
  return offset;
}

export function rowOffset(sheet: Sheet, row: number): number {
  let offset = row * GRID.rowHeight;
  for (const [key, height] of Object.entries(sheet.rowHeights)) {
    const index = Number.parseInt(key, 10);
    if (Number.isFinite(index) && index >= 0 && index < row) {
      offset += height - GRID.rowHeight;
    }
  }
  return offset;
}

export function columnAtOffset(sheet: Sheet, offset: number): number {
  let col = Math.min(Math.max(Math.floor(offset / GRID.columnWidth), 0), GRID.columnCount - 1);

  while (col > 0 && columnOffset(sheet, col) > offset) {
    col -= 1;
  }
  while (col < GRID.columnCount - 1 && columnOffset(sheet, col) + columnWidth(sheet, col) <= offset) {
    col += 1;
  }

  return col;
}

export function rowAtOffset(sheet: Sheet, offset: number): number {
  let row = Math.min(Math.max(Math.floor(offset / GRID.rowHeight), 0), GRID.rowCount - 1);

  while (row > 0 && rowOffset(sheet, row) > offset) {
    row -= 1;
  }
  while (row < GRID.rowCount - 1 && rowOffset(sheet, row) + rowHeight(sheet, row) <= offset) {
    row += 1;
  }

  return row;
}

export function sheetPixelWidth(sheet: Sheet): number {
  return (
    GRID.rowHeaderWidth +
    GRID.columnCount * GRID.columnWidth +
    Object.values(sheet.columnWidths).reduce((sum, width) => sum + width - GRID.columnWidth, 0)
  );
}

export function sheetPixelHeight(sheet: Sheet): number {
  return (
    GRID.columnHeaderHeight +
    GRID.rowCount * GRID.rowHeight +
    Object.values(sheet.rowHeights).reduce((sum, height) => sum + height - GRID.rowHeight, 0)
  );
}

export function cellKey(address: CellAddress): string {
  return `${address.row}:${address.col}`;
}

export function normalizeRange(range: CellRange): CellRange {
  return {
    start: {
      row: Math.min(range.start.row, range.end.row),
      col: Math.min(range.start.col, range.end.col)
    },
    end: {
      row: Math.max(range.start.row, range.end.row),
      col: Math.max(range.start.col, range.end.col)
    }
  };
}

export function isCellInRange(address: CellAddress, range: CellRange): boolean {
  const normalized = normalizeRange(range);
  return (
    address.row >= normalized.start.row &&
    address.row <= normalized.end.row &&
    address.col >= normalized.start.col &&
    address.col <= normalized.end.col
  );
}

export function columnName(col: number): string {
  let dividend = col + 1;
  let name = "";

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return name;
}

export function parseAddress(label: string): CellAddress | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(label.trim());
  if (!match) {
    return null;
  }

  const columnLabel = match[1].toUpperCase();
  const row = Number.parseInt(match[2], 10) - 1;
  let col = 0;

  for (const char of columnLabel) {
    col = col * 26 + (char.charCodeAt(0) - 64);
  }

  return { row, col: col - 1 };
}

export function addressLabel(address: CellAddress): string {
  return `${columnName(address.col)}${address.row + 1}`;
}

export function rangeLabel(range: CellRange): string {
  const normalized = normalizeRange(range);
  const start = addressLabel(normalized.start);
  const end = addressLabel(normalized.end);
  return start === end ? start : `${start}:${end}`;
}

export function formulaWithRangeReference(input: string, range: CellRange): string {
  const reference = rangeLabel(range);
  if (!input.startsWith("=")) {
    return input;
  }

  const trailingReference = /(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)$/i;
  if (trailingReference.test(input)) {
    return input.replace(trailingReference, reference);
  }

  return `${input}${reference}`;
}

export function createEmptyCell(): CellData {
  return {
    value: null,
    displayValue: "",
    format: { kind: "text", numberFormat: "plain" },
    style: {}
  };
}

export function inferCellData(input: string): CellData {
  const trimmed = input.trim();

  if (trimmed.startsWith("=")) {
    return {
      value: input,
      displayValue: input,
      formula: input,
      format: { kind: "formula", numberFormat: "plain" },
      style: {}
    };
  }

  if (trimmed === "TRUE" || trimmed === "FALSE") {
    const value = trimmed === "TRUE";
    return {
      value,
      displayValue: String(value).toUpperCase(),
      format: { kind: "boolean", numberFormat: "plain" },
      style: {}
    };
  }

  const numericValue = Number(trimmed.replace(/[$,%]/g, ""));
  if (trimmed !== "" && Number.isFinite(numericValue)) {
    const numberFormat = trimmed.includes("$")
      ? "currency"
      : trimmed.includes("%")
        ? "percent"
        : trimmed.includes(".")
          ? "decimal"
          : "plain";

    return {
      value: numberFormat === "percent" ? numericValue / 100 : numericValue,
      displayValue: formatNumber(numberFormat === "percent" ? numericValue / 100 : numericValue, numberFormat),
      format: {
        kind: numberFormat === "currency" ? "currency" : "number",
        numberFormat,
        currencySymbol: numberFormat === "currency" ? "$" : undefined
      },
      style: {}
    };
  }

  return {
    value: input,
    displayValue: input,
    format: { kind: "text", numberFormat: "plain" },
    style: {}
  };
}

export function formatNumber(
  value: number,
  format: CellFormat["numberFormat"] = "plain",
  currencySymbol = "$"
): string {
  if (format === "currency") {
    return `${currencySymbol}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)}`;
  }

  if (format === "percent") {
    return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 }).format(value);
  }

  if (format === "decimal") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 12 }).format(value);
}

export function clampAddress(address: CellAddress): CellAddress {
  return {
    row: Math.min(Math.max(address.row, 0), GRID.rowCount - 1),
    col: Math.min(Math.max(address.col, 0), GRID.columnCount - 1)
  };
}

export function offsetFormulaReferences(formula: string, rowOffset: number, colOffset: number): string {
  return formula.replace(/\$?([A-Z]{1,3})\$?(\d+)/gi, (match) => {
    const absoluteCol = match.startsWith("$");
    const rowToken = match.match(/\$?\d+$/)?.[0] ?? "";
    const absoluteRow = rowToken.startsWith("$");
    const parsed = parseAddress(match.replaceAll("$", ""));

    if (!parsed) {
      return match;
    }

    const nextAddress = clampAddress({
      row: absoluteRow ? parsed.row : parsed.row + rowOffset,
      col: absoluteCol ? parsed.col : parsed.col + colOffset
    });

    return `${absoluteCol ? "$" : ""}${columnName(nextAddress.col)}${absoluteRow ? "$" : ""}${nextAddress.row + 1}`;
  });
}
