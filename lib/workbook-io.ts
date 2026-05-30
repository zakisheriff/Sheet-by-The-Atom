"use client";

import type { Sheet } from "./grid";
import { cellKey } from "./grid";

export type WorkbookExportFormat = "xlsx" | "csv" | "tsv" | "json" | "google-sheets";

export type ImportedWorkbook = {
  name: string;
  rows: string[][];
};

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

    worksheet.eachRow({ includeEmpty: true }, (excelRow, rowNumber) => {
      const values: string[] = [];
      for (let col = 1; col <= worksheet.columnCount; col += 1) {
        const value = excelRow.getCell(col).value;
        if (value === null || value === undefined) {
          values.push("");
        } else if (typeof value === "object" && "formula" in value) {
          values.push(`=${String(value.formula)}`);
        } else if (typeof value === "object" && "text" in value) {
          values.push(String(value.text));
        } else {
          values.push(String(value));
        }
      }
      rows[rowNumber - 1] = values;
    });

    return {
      name: worksheet.name || file.name.replace(/\.[^.]+$/, ""),
      rows
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
