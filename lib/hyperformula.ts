import { HyperFormula } from "hyperformula";
import type { CellAddress, CellData, Sheet } from "./grid";
import { cellKey, createEmptyCell, formatNumber } from "./grid";

const ENGINE_SHEET_NAME = "Workbook";

let engine: HyperFormula | null = null;
let engineSheetId: number | null = null;

export const FORMULA_SUGGESTIONS = HyperFormula.getRegisteredFunctionNames("enGB").sort();

export function getFormulaEngine(): HyperFormula {
  if (!engine) {
    engine = HyperFormula.buildEmpty({
      licenseKey: "gpl-v3",
      useColumnIndex: true,
      useStats: false
    });
    const sheetName = engine.addSheet(ENGINE_SHEET_NAME);
    engineSheetId = engine.getSheetId(sheetName) ?? null;
  }

  return engine;
}

export function syncSheetToFormulaEngine(sheet: Sheet): void {
  const hf = getFormulaEngine();
  const sheetId = engineSheetId;

  if (sheetId === null) {
    return;
  }

  hf.clearSheet(sheetId);

  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [rowPart, colPart] = key.split(":");
    const row = Number.parseInt(rowPart, 10);
    const col = Number.parseInt(colPart, 10);
    const content = cell.formula ?? cell.value ?? "";
    hf.setCellContents({ sheet: sheetId, row, col }, [[content]]);
  }
}

export function evaluateCell(address: CellAddress, cell: CellData): CellData {
  if (!cell.formula) {
    return cell;
  }

  const hf = getFormulaEngine();
  const sheetId = engineSheetId;

  if (sheetId === null) {
    return cell;
  }

  try {
    const value = hf.getCellValue({ sheet: sheetId, row: address.row, col: address.col });

    if (typeof value === "object" && value !== null && "message" in value) {
      return {
        ...cell,
        displayValue: "#ERROR!",
        error: String(value.message)
      };
    }

    if (typeof value === "number") {
      return {
        ...cell,
        value,
        displayValue: formatNumber(value, cell.format.numberFormat, cell.format.currencySymbol),
        error: undefined
      };
    }

    return {
      ...cell,
      value: typeof value === "string" || typeof value === "boolean" ? value : cell.value,
      displayValue: value === null ? "" : String(value),
      error: undefined
    };
  } catch (error) {
    return {
      ...cell,
      displayValue: "#CYCLE!",
      error: error instanceof Error ? error.message : "Formula evaluation failed"
    };
  }
}

export function recalculateSheet(sheet: Sheet): Sheet {
  syncSheetToFormulaEngine(sheet);

  const cells: Sheet["cells"] = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [rowPart, colPart] = key.split(":");
    const col = Number.parseInt(colPart, 10);
    if (Number.isNaN(col)) {
      continue;
    }

    cells[key] = evaluateCell(
      { row: Number.parseInt(rowPart, 10), col },
      cell
    );
  }

  return { ...sheet, cells };
}

export function getCellPrecedents(address: CellAddress): CellAddress[] {
  const hf = getFormulaEngine();
  const sheetId = engineSheetId;

  if (sheetId === null) {
    return [];
  }

  try {
    const precedents = hf.getCellPrecedents({ sheet: sheetId, row: address.row, col: address.col });
    return precedents.flatMap((precedent) => {
      if ("row" in precedent && "col" in precedent) {
        return [{ row: precedent.row, col: precedent.col }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

export function getFormulaSuggestions(input: string): string[] {
  const candidate = input.replace(/^=/, "").toUpperCase();
  if (!candidate) {
    return [...FORMULA_SUGGESTIONS];
  }

  return FORMULA_SUGGESTIONS.filter((name) => name.startsWith(candidate));
}
