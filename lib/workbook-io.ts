"use client";

import type { Border, Cell, CellFormulaValue, CellHyperlinkValue, CellRichTextValue, CellSharedFormulaValue, CellValue, Color, Fill } from "exceljs";
import type { CellData, CellFormat, CellRange, CellStyle, Sheet } from "./grid";
import { cellKey, createEmptyCell, formatNumber, inferCellData, parseAddress } from "./grid";

export type WorkbookExportFormat = "xlsx" | "csv" | "tsv" | "json" | "google-sheets";

export type ImportedWorkbook = {
  name: string;
  rows: string[][];
  cells?: Sheet["cells"];
  rowHeights?: Sheet["rowHeights"];
  columnWidths?: Sheet["columnWidths"];
  mergedCells?: Sheet["mergedCells"];
};

const EXCEL_POINT_TO_PIXEL = 4 / 3;
const EXCEL_COLUMN_CHAR_TO_PIXEL = 8;

function hasKey<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === "object" && value !== null && key in value;
}

function colorToHex(color?: Partial<Color>): string | undefined {
  if (!color?.argb) {
    return undefined;
  }

  const hex = color.argb.length === 8 ? color.argb.slice(2) : color.argb;
  return /^[\dA-F]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : undefined;
}

function fillToHex(fill?: Fill): string | undefined {
  if (!fill || fill.type !== "pattern") {
    return undefined;
  }

  return colorToHex(fill.fgColor) ?? colorToHex(fill.bgColor);
}

function borderWidth(border?: Partial<Border>): number | undefined {
  if (!border?.style) {
    return undefined;
  }

  if (border.style === "medium" || border.style === "mediumDashed" || border.style === "mediumDashDot" || border.style === "mediumDashDotDot") {
    return 2;
  }

  if (border.style === "thick" || border.style === "double") {
    return 3;
  }

  return 1;
}

function borderStyle(border?: Partial<Border>): { color: string; width: number } | undefined {
  const width = borderWidth(border);
  if (!width) {
    return undefined;
  }

  return { color: colorToHex(border?.color) ?? "#171717", width };
}

function excelCellStyle(cell: Cell): CellStyle {
  const borders = {
    top: borderStyle(cell.border?.top),
    right: borderStyle(cell.border?.right),
    bottom: borderStyle(cell.border?.bottom),
    left: borderStyle(cell.border?.left)
  };
  const hasBorders = Object.values(borders).some(Boolean);

  return {
    bold: cell.font?.bold || undefined,
    italic: cell.font?.italic || undefined,
    underline: Boolean(cell.font?.underline && cell.font.underline !== "none") || undefined,
    textColor: colorToHex(cell.font?.color),
    fillColor: fillToHex(cell.fill),
    align:
      cell.alignment?.horizontal === "center" || cell.alignment?.horizontal === "centerContinuous"
        ? "center"
        : cell.alignment?.horizontal === "right"
          ? "right"
          : cell.alignment?.horizontal === "left"
            ? "left"
            : undefined,
    verticalAlign:
      cell.alignment?.vertical === "top"
        ? "top"
        : cell.alignment?.vertical === "bottom"
          ? "bottom"
          : cell.alignment?.vertical === "middle"
            ? "middle"
            : undefined,
    fontFamily: cell.font?.name,
    fontSize: cell.font?.size,
    borders: hasBorders ? borders : undefined
  };
}

function hasCellStyle(style: CellStyle): boolean {
  return Boolean(
    style.bold ||
      style.italic ||
      style.underline ||
      style.textColor ||
      style.fillColor ||
      style.align ||
      style.verticalAlign ||
      style.fontFamily ||
      style.fontSize ||
      style.borders
  );
}

function formulaFromValue(value: CellValue): string | undefined {
  if (hasKey(value, "formula") && typeof value.formula === "string") {
    return value.formula;
  }

  if (hasKey(value, "sharedFormula")) {
    const shared = value as CellSharedFormulaValue;
    return shared.formula ?? (typeof shared.sharedFormula === "string" ? shared.sharedFormula : undefined);
  }

  return undefined;
}

function primitiveFromValue(value: CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
    return value;
  }

  if (hasKey(value, "result")) {
    const result = (value as CellFormulaValue | CellSharedFormulaValue).result;
    return primitiveFromValue(result);
  }

  if (hasKey(value, "richText") && Array.isArray(value.richText)) {
    return (value as CellRichTextValue).richText.map((part) => part.text).join("");
  }

  if (hasKey(value, "text") && typeof value.text === "string") {
    return (value as CellHyperlinkValue).text;
  }

  if (hasKey(value, "error") && typeof value.error === "string") {
    return value.error;
  }

  return "";
}

function currencySymbolFromNumberFormat(numberFormat: string): string | undefined {
  const quotedSymbol = /"([^"]+)"/.exec(numberFormat)?.[1];
  if (quotedSymbol) {
    return quotedSymbol;
  }

  if (numberFormat.includes("$")) {
    return "$";
  }
  if (numberFormat.toLowerCase().includes("lkr")) {
    return "LKR";
  }
  if (numberFormat.toLowerCase().includes("rs")) {
    return "Rs";
  }

  return undefined;
}

function formatDateForExcel(date: Date, numberFormat: string): string {
  const day = new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(date);
  const monthShort = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
  const yearTwo = new Intl.DateTimeFormat("en-US", { year: "2-digit" }).format(date);
  const yearFull = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(date);
  const normalized = numberFormat.toLowerCase();

  if (normalized.includes("mmm-yy")) {
    return `${monthShort}-${yearTwo}`;
  }
  if (normalized.includes("d-mmm")) {
    return `${Number(day)}-${monthShort}`;
  }
  if (normalized.includes("yyyy")) {
    return `${day}-${monthShort}-${yearFull}`;
  }

  return date.toLocaleDateString("en-US");
}

function displayValueForCell(cell: Cell, primitive: string | number | boolean | Date | null): string {
  const numberFormat = cell.numFmt ?? "";
  const normalized = numberFormat.toLowerCase();

  if (primitive instanceof Date) {
    return formatDateForExcel(primitive, numberFormat);
  }

  if (typeof primitive === "number") {
    const currencySymbol = currencySymbolFromNumberFormat(numberFormat);
    if (currencySymbol) {
      return formatNumber(primitive, "currency", currencySymbol);
    }
    if (normalized.includes("%")) {
      return formatNumber(primitive, "percent");
    }
    if (normalized.includes(".00")) {
      return formatNumber(primitive, "decimal");
    }
  }

  return cell.text || String(primitive ?? "");
}

function formatForCell(cell: Cell, primitive: string | number | boolean | Date | null): CellFormat {
  const rawNumberFormat = cell.numFmt ?? "";
  const numberFormat = rawNumberFormat.toLowerCase();
  const currencySymbol = currencySymbolFromNumberFormat(rawNumberFormat);

  if (cell.formula) {
    return { kind: "formula", numberFormat: currencySymbol ? "currency" : numberFormat.includes("%") ? "percent" : "plain", currencySymbol };
  }

  if (primitive instanceof Date || /[dmy]/i.test(numberFormat)) {
    return { kind: "date", numberFormat: "plain" };
  }

  if (typeof primitive === "boolean") {
    return { kind: "boolean", numberFormat: "plain" };
  }

  if (typeof primitive === "number") {
    if (numberFormat.includes("%")) {
      return { kind: "number", numberFormat: "percent" };
    }
    if (currencySymbol) {
      return { kind: "currency", numberFormat: "currency", currencySymbol };
    }
    return { kind: "number", numberFormat: numberFormat.includes(".") ? "decimal" : "plain" };
  }

  return { kind: "text", numberFormat: "plain" };
}

function excelCellData(cell: Cell): CellData {
  const formula = formulaFromValue(cell.value);
  const primitive = primitiveFromValue(cell.value);
  const displayValue = displayValueForCell(cell, primitive);
  const baseCell = formula ? inferCellData(`=${formula}`) : createEmptyCell();

  return {
    ...baseCell,
    value: formula ? baseCell.value : primitive,
    displayValue: formula ? baseCell.displayValue : displayValue,
    formula: formula ? `=${formula}` : undefined,
    format: formatForCell(cell, primitive),
    style: excelCellStyle(cell)
  };
}

function parseMergeRange(range: string): CellRange | null {
  const [startLabel, endLabel] = range.split(":");
  const start = parseAddress(startLabel);
  const end = parseAddress(endLabel ?? startLabel);

  return start && end ? { start, end } : null;
}

function isMergeChild(row: number, col: number, ranges: CellRange[]): boolean {
  return ranges.some(
    (range) =>
      row >= range.start.row &&
      row <= range.end.row &&
      col >= range.start.col &&
      col <= range.end.col &&
      (row !== range.start.row || col !== range.start.col)
  );
}

function parseDelimited(text: string, delimiter: "," | "\t"): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function rowsToDelimited(rows: string[][], delimiter: "," | "\t"): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const needsQuotes = value.includes(delimiter) || value.includes("\n") || value.includes('"');
          return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
        })
        .join(delimiter)
    )
    .join("\n");
}

export function sheetToRows(sheet: Sheet): string[][] {
  const addresses = Object.keys(sheet.cells).map((key) => {
    const [rowPart, colPart] = key.split(":");
    return {
      row: Number.parseInt(rowPart, 10),
      col: Number.parseInt(colPart, 10)
    };
  });
  const maxRow = Math.max(0, ...addresses.map((address) => address.row));
  const maxCol = Math.max(0, ...addresses.map((address) => address.col));
  const rows: string[][] = [];

  for (let row = 0; row <= maxRow; row += 1) {
    const values: string[] = [];
    for (let col = 0; col <= maxCol; col += 1) {
      const cell = sheet.cells[cellKey({ row, col })];
      values.push(cell?.formula ?? cell?.displayValue ?? "");
    }
    rows.push(values);
  }

  return rows;
}

export async function importWorkbookFile(file: File): Promise<ImportedWorkbook> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv" || extension === "gsheet-csv") {
    return {
      name: file.name.replace(/\.[^.]+$/, ""),
      rows: parseDelimited(await file.text(), ",")
    };
  }

  if (extension === "tsv") {
    return {
      name: file.name.replace(/\.[^.]+$/, ""),
      rows: parseDelimited(await file.text(), "\t")
    };
  }

  if (extension === "json") {
    const parsed = JSON.parse(await file.text()) as { name?: string; rows?: unknown };
    if (!Array.isArray(parsed.rows)) {
      throw new Error("JSON imports must contain a rows array.");
    }

    return {
      name: parsed.name ?? file.name.replace(/\.[^.]+$/, ""),
      rows: parsed.rows.map((row) => (Array.isArray(row) ? row.map((value) => String(value ?? "")) : []))
    };
  }

  if (extension === "xlsx" || extension === "xlsm") {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    const rows: string[][] = [];
    const cells: Sheet["cells"] = {};
    const rowHeights: Sheet["rowHeights"] = {};
    const columnWidths: Sheet["columnWidths"] = {};
    const mergedCells = worksheet.model.merges.map(parseMergeRange).filter((range): range is CellRange => range !== null);

    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const excelRow = worksheet.getRow(rowNumber);
      const values: string[] = [];

      if (excelRow.height) {
        rowHeights[rowNumber - 1] = Math.round(excelRow.height * EXCEL_POINT_TO_PIXEL);
      }

      for (let col = 1; col <= worksheet.columnCount; col += 1) {
        const cell = excelRow.getCell(col);
        if (isMergeChild(rowNumber - 1, col - 1, mergedCells)) {
          values.push("");
          continue;
        }

        const importedCell = excelCellData(cell);
        const inputValue = importedCell.formula ?? importedCell.displayValue;
        values.push(inputValue);

        if (inputValue.trim().length > 0 || hasCellStyle(importedCell.style)) {
          cells[cellKey({ row: rowNumber - 1, col: col - 1 })] = importedCell;
        }
      }
      rows[rowNumber - 1] = values;
    }

    worksheet.columns.forEach((column, index) => {
      if (column.width) {
        columnWidths[index] = Math.round(column.width * EXCEL_COLUMN_CHAR_TO_PIXEL + 12);
      }
    });

    return {
      name: worksheet.name || file.name.replace(/\.[^.]+$/, ""),
      rows,
      cells,
      rowHeights,
      columnWidths,
      mergedCells
    };
  }

  throw new Error("Supported imports are .xlsx, .xlsm, .csv, .tsv, and .json.");
}

export async function exportSheetBlob(sheet: Sheet, format: WorkbookExportFormat): Promise<{ blob: Blob; filename: string }> {
  const rows = sheetToRows(sheet);
  const safeName = sheet.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "Sheet";

  if (format === "xlsx" || format === "google-sheets") {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Atom Sheets";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet(sheet.name);
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      blob: new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }),
      filename: format === "google-sheets" ? `${safeName}-google-sheets.xlsx` : `${safeName}.xlsx`
    };
  }

  if (format === "json") {
    return {
      blob: new Blob([JSON.stringify({ name: sheet.name, rows }, null, 2)], { type: "application/json" }),
      filename: `${safeName}.json`
    };
  }

  const delimiter = format === "tsv" ? "\t" : ",";
  return {
    blob: new Blob([rowsToDelimited(rows, delimiter)], {
      type: format === "tsv" ? "text/tab-separated-values;charset=utf-8" : "text/csv;charset=utf-8"
    }),
    filename: format === "tsv" ? `${safeName}.tsv` : `${safeName}.csv`
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
