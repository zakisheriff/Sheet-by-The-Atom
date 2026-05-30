"use client";

import { useRef, useState } from "react";
import {
  Columns3,
  Copy,
  Download,
  HardDrive,
  Link2,
  Rows3,
  Redo2,
  Save,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Undo2,
  WandSparkles
} from "lucide-react";
import { FontControls } from "./FontControls";
import { FormatControls } from "./FormatControls";
import type { CellAddress, CellRange, Sheet } from "@/lib/grid";
import { cellKey, normalizeRange, rangeLabel } from "@/lib/grid";
import { useSpreadsheetStore } from "@/lib/store";
import {
  saveWorkbookToDrive,
  signInToGoogleDrive,
  type DriveWorkbookPayload,
  type GoogleDriveSession
} from "@/lib/driveService";
import { downloadBlob, exportSheetBlob, importWorkbookFile, type WorkbookExportFormat } from "@/lib/workbook-io";

type ToolbarProps = {
  onOpenFind: () => void;
  onNotify: (message: string) => void;
};

type RibbonTab = "home" | "insert" | "formulas" | "data";

export function Toolbar({ onOpenFind, onNotify }: ToolbarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("home");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [driveSession, setDriveSession] = useState<GoogleDriveSession | null>(null);
  const [driveSigningIn, setDriveSigningIn] = useState(false);
  const [driveSaving, setDriveSaving] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const undo = useSpreadsheetStore((state) => state.undo);
  const redo = useSpreadsheetStore((state) => state.redo);
  const dirty = useSpreadsheetStore((state) => state.dirty);
  const markSaved = useSpreadsheetStore((state) => state.markSaved);
  const toggleCommandPalette = useSpreadsheetStore((state) => state.toggleCommandPalette);
  const insertRowBelow = useSpreadsheetStore((state) => state.insertRowBelow);
  const insertColumnRight = useSpreadsheetStore((state) => state.insertColumnRight);
  const clearSelection = useSpreadsheetStore((state) => state.clearSelection);
  const setCellInput = useSpreadsheetStore((state) => state.setCellInput);
  const selectCell = useSpreadsheetStore((state) => state.selectCell);
  const importRows = useSpreadsheetStore((state) => state.importRows);
  const selection = useSpreadsheetStore((state) => state.selection);
  const activeSheet = useSpreadsheetStore((state) => state.getActiveSheet());
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const workbookId = useSpreadsheetStore((state) => state.workbookId);
  const driveFileId = useSpreadsheetStore((state) => state.driveFileId);
  const driveShareUrl = useSpreadsheetStore((state) => state.driveShareUrl);
  const driveSyncStatus = useSpreadsheetStore((state) => state.driveSyncStatus);
  const driveError = useSpreadsheetStore((state) => state.driveError);
  const setDriveState = useSpreadsheetStore((state) => state.setDriveState);

  const tabs: Array<{ id: RibbonTab; label: string }> = [
    { id: "home", label: "Home" },
    { id: "insert", label: "Insert" },
    { id: "formulas", label: "Formulas" },
    { id: "data", label: "Data" }
  ];

  const shareWorkbook = async () => {
    if (driveShareUrl) {
      setShareModalOpen(true);
      return;
    }

    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "Atom Sheets", url });
      onNotify("Share sheet opened");
      return;
    }
    await navigator.clipboard.writeText(url);
    onNotify("Workbook link copied");
  };

  const exportWorkbook = async (format: WorkbookExportFormat) => {
    const { blob, filename } = await exportSheetBlob(activeSheet, format);
    downloadBlob(blob, filename);
    setExportMenuOpen(false);
    onNotify(`Exported ${filename}`);
  };

  const workbookTitle = workbookId === "demo-workbook" ? "Financial Model" : activeSheet.name || "Untitled Sheet";

  const drivePayload = (session: GoogleDriveSession): DriveWorkbookPayload => ({
    version: 1,
    workbook: {
      workbookId,
      activeSheetId,
      sheets
    },
    metadata: {
      title: workbookTitle,
      lastModified: new Date().toISOString(),
      owner: session.profile.email
    }
  });

  const saveToDrive = async () => {
    setDriveSaving(true);
    try {
      if (!driveSession) {
        setDriveSigningIn(true);
      }
      const session = driveSession ?? (await signInToGoogleDrive());
      setDriveSession(session);
      const result = await saveWorkbookToDrive({
        fileId: driveFileId,
        title: workbookTitle,
        payload: drivePayload(session)
      });
      setDriveState({
        fileId: result.fileId,
        modifiedTime: result.modifiedTime,
        shareUrl: result.shareUrl,
        status: "saved",
        error: null
      });
      markSaved();
      onNotify("Saved to Google Drive");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Google Drive save failed");
    } finally {
      setDriveSaving(false);
      setDriveSigningIn(false);
    }
  };

  const copyDriveLink = async () => {
    if (!driveShareUrl) {
      return;
    }

    await navigator.clipboard.writeText(driveShareUrl);
    onNotify("Drive link copied");
  };

  const driveButtonLabel =
    driveSaving || driveSyncStatus === "syncing"
      ? "Syncing..."
      : driveSyncStatus === "offline"
        ? "Offline"
        : driveSyncStatus === "error"
          ? "Sync error"
          : driveFileId
            ? "Saved to Drive ✓"
            : driveSigningIn
              ? "Signing in..."
              : "Save to Drive";

  const isNumericCell = (sheet: Sheet, address: CellAddress) =>
    typeof sheet.cells[cellKey(address)]?.value === "number";

  const inferAutoFormulaRange = (address: CellAddress): CellRange => {
    const maxGap = 3;
    let skipped = 0;
    let endRow = -1;

    for (let row = address.row - 1; row >= 0; row -= 1) {
      if (isNumericCell(activeSheet, { row, col: address.col })) {
        endRow = row;
        break;
      }
      skipped += 1;
      if (skipped >= maxGap) {
        break;
      }
    }

    if (endRow >= 0) {
      let startRow = endRow;
      for (let row = endRow - 1; row >= 0 && isNumericCell(activeSheet, { row, col: address.col }); row -= 1) {
        startRow = row;
      }
      return { start: { row: startRow, col: address.col }, end: { row: endRow, col: address.col } };
    }

    skipped = 0;
    let endCol = -1;
    for (let col = address.col - 1; col >= 0; col -= 1) {
      if (isNumericCell(activeSheet, { row: address.row, col })) {
        endCol = col;
        break;
      }
      skipped += 1;
      if (skipped >= maxGap) {
        break;
      }
    }

    if (endCol >= 0) {
      let startCol = endCol;
      for (let col = endCol - 1; col >= 0 && isNumericCell(activeSheet, { row: address.row, col }); col -= 1) {
        startCol = col;
      }
      return { start: { row: address.row, col: startCol }, end: { row: address.row, col: endCol } };
    }

    return { start: address, end: address };
  };

  const formulaTargetForSelection = (range: CellRange): CellAddress => {
    const normalized = normalizeRange(range);
    const isSingleCell = normalized.start.row === normalized.end.row && normalized.start.col === normalized.end.col;

    if (isSingleCell) {
      return normalized.end;
    }

    if (normalized.start.col === normalized.end.col) {
      return { row: normalized.end.row + 1, col: normalized.start.col };
    }

    if (normalized.start.row === normalized.end.row) {
      return { row: normalized.start.row, col: normalized.end.col + 1 };
    }

    return { row: normalized.end.row + 1, col: normalized.start.col };
  };

  const formulaRangeForSelection = (range: CellRange): CellRange => {
    const normalized = normalizeRange(range);
    const isSingleCell = normalized.start.row === normalized.end.row && normalized.start.col === normalized.end.col;
    return isSingleCell ? inferAutoFormulaRange(normalized.end) : normalized;
  };

  const insertAggregateFormula = (formula: "SUM" | "AVERAGE" | "COUNT" | "MIN" | "MAX") => {
    const formulaRange = formulaRangeForSelection(selection);
    const target = formulaTargetForSelection(selection);
    setCellInput(target, `=${formula}(${rangeLabel(formulaRange)})`);
    selectCell(target);
    onNotify(`Inserted ${formula} for ${rangeLabel(formulaRange)}`);
  };

  return (
    <div className="flex min-h-[var(--toolbar-height)] items-center gap-2 overflow-x-auto border-b border-neutral-300 bg-[#f7f7f5] px-2 py-1 sm:px-3">
      <div className="flex h-full shrink-0 items-center gap-1 border-r border-neutral-300 pr-2 sm:gap-2 sm:pr-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={
              activeTab === tab.id
                ? "flex h-9 items-center gap-1.5 rounded-[18px] bg-[#2F7D4D] px-4 text-xs font-bold text-white"
                : "h-9 rounded-[18px] px-4 text-xs font-bold text-neutral-700 hover:bg-white"
            }
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1 border-r border-neutral-300 pr-2 sm:pr-3">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-[18px] text-neutral-700 transition hover:bg-white"
          onClick={undo}
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-[18px] text-neutral-700 transition hover:bg-white"
          onClick={redo}
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-[18px] text-neutral-700 transition hover:bg-white"
          onClick={markSaved}
          aria-label="Save"
        >
          <Save className="h-4 w-4" />
        </button>
      </div>
      {activeTab === "home" ? (
        <>
          <FontControls />
          <FormatControls />
        </>
      ) : null}
      {activeTab === "insert" ? (
        <div className="flex shrink-0 items-center gap-1 border-r border-neutral-300 pr-2">
          <button
            type="button"
            className="flex h-9 items-center gap-1.5 rounded-[18px] px-4 text-xs font-bold text-neutral-700 hover:bg-white"
            onClick={() => {
              insertRowBelow();
              onNotify("Inserted row below selection");
            }}
          >
            <Rows3 className="h-4 w-4" />
            Row
          </button>
          <button
            type="button"
            className="flex h-9 items-center gap-1.5 rounded-[18px] px-4 text-xs font-bold text-neutral-700 hover:bg-white"
            onClick={() => {
              insertColumnRight();
              onNotify("Inserted column right of selection");
            }}
          >
            <Columns3 className="h-4 w-4" />
            Column
          </button>
        </div>
      ) : null}
      {activeTab === "formulas" ? (
        <div className="flex shrink-0 items-center gap-1 border-r border-neutral-300 pr-2">
          {(["SUM", "AVERAGE", "COUNT", "MIN", "MAX"] as const).map((formula) => (
            <button
              key={formula}
              type="button"
              className="h-9 rounded-[18px] px-4 text-xs font-bold text-neutral-700 hover:bg-white"
              onClick={() => insertAggregateFormula(formula)}
            >
              {formula}
            </button>
          ))}
          <button
            type="button"
            className="h-9 rounded-[18px] px-4 text-xs font-bold text-neutral-700 hover:bg-white"
            onClick={() => {
              setCellInput(selection.end, '=IF(A1="","",A1)');
              onNotify("Inserted editable IF formula");
            }}
          >
            IF
          </button>
        </div>
      ) : null}
      {activeTab === "data" ? (
        <div className="flex shrink-0 items-center gap-1 border-r border-neutral-300 pr-2">
          <button
            type="button"
            className="flex h-9 items-center gap-1.5 rounded-[18px] px-4 text-xs font-bold text-neutral-700 hover:bg-white"
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </button>
          <button
            type="button"
            className="flex h-9 items-center gap-1.5 rounded-[18px] px-4 text-xs font-bold text-neutral-700 hover:bg-white"
            onClick={() => {
              clearSelection();
              onNotify("Cleared selected cells");
            }}
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      ) : null}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-[18px] text-neutral-700 transition hover:bg-white"
          onClick={onOpenFind}
          aria-label="Find and replace"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-[18px] text-neutral-700 transition hover:bg-white"
          onClick={() => toggleCommandPalette(true)}
          aria-label="Open command palette"
        >
          <WandSparkles className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-[18px] text-neutral-700 transition hover:bg-white"
          onClick={() => {
            insertAggregateFormula("SUM");
          }}
          aria-label="Automation actions"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-[18px] text-neutral-700 transition hover:bg-white"
            onClick={() => setExportMenuOpen((open) => !open)}
            aria-label="Export workbook"
          >
            <Download className="h-4 w-4" />
          </button>
          {exportMenuOpen ? (
            <div className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-[20px] border border-neutral-200 bg-white py-1 text-sm">
              {[
                ["xlsx", "Excel workbook (.xlsx)"],
                ["google-sheets", "Google Sheets-ready (.xlsx)"],
                ["csv", "CSV (.csv)"],
                ["tsv", "Tab-separated (.tsv)"],
                ["json", "JSON workbook data"]
              ].map(([format, label]) => (
                <button
                  key={format}
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-green-50"
                  onClick={() => void exportWorkbook(format as WorkbookExportFormat)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.csv,.tsv,.json"
        className="hidden"
        onChange={(event) => {
          const input = event.currentTarget;
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          void importWorkbookFile(file)
            .then((workbook) => {
              importRows(workbook.rows, workbook.name, {
                cells: workbook.cells,
                rowHeights: workbook.rowHeights,
                columnWidths: workbook.columnWidths,
                mergedCells: workbook.mergedCells
              });
              onNotify(`Imported ${file.name}`);
            })
            .catch((error: unknown) => {
              onNotify(error instanceof Error ? error.message : "Import failed");
            })
            .finally(() => {
              input.value = "";
            });
        }}
      />
      <button
        type="button"
        className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-[18px] border border-[#2F7D4D]/30 bg-white px-4 text-xs font-bold text-[#2F7D4D] transition hover:bg-[#ecf6ef]"
        onClick={() => void saveToDrive()}
        disabled={driveSigningIn || driveSaving}
        aria-label="Save to Google Drive"
      >
        {driveSession?.profile.picture ? (
          <span
            aria-hidden="true"
            className="h-5 w-5 rounded-full bg-cover bg-center"
            style={{ backgroundImage: `url(${driveSession.profile.picture})` }}
          />
        ) : (
          <HardDrive className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{driveButtonLabel}</span>
      </button>
      {driveShareUrl ? (
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[18px] border border-[#2F7D4D]/30 bg-white text-[#2F7D4D] transition hover:bg-[#ecf6ef]"
          onClick={() => setShareModalOpen(true)}
          aria-label="Open Drive share link"
        >
          <Link2 className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-[18px] border border-[#2F7D4D]/30 bg-white px-4 text-xs font-bold text-[#2F7D4D] transition hover:bg-[#ecf6ef]"
        onClick={shareWorkbook}
        aria-label="Share workbook"
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>
      <div className="text-xs font-medium text-neutral-500">
        {driveError ?? (dirty ? "Unsaved changes" : driveFileId ? "Drive synced" : "Saved")}
      </div>
      {shareModalOpen && driveShareUrl ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-[24px] border border-neutral-200 bg-white p-5 text-neutral-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">Share Drive sheet</h2>
                <p className="mt-1 text-sm font-medium text-neutral-500">
                  Anyone with access to the Drive file can open this Atom Sheets link.
                </p>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-[18px] text-neutral-500 hover:bg-neutral-100"
                onClick={() => setShareModalOpen(false)}
                aria-label="Close share dialog"
              >
                ×
              </button>
            </div>
            <div className="mt-5 flex gap-2 rounded-[18px] border border-neutral-200 bg-neutral-50 p-2">
              <input
                readOnly
                value={driveShareUrl}
                className="min-w-0 flex-1 bg-transparent px-2 text-sm font-medium outline-none"
                aria-label="Drive share link"
              />
              <button
                type="button"
                className="flex h-10 shrink-0 items-center gap-2 rounded-[16px] bg-[#2F7D4D] px-4 text-sm font-bold text-white hover:bg-[#24643d]"
                onClick={() => void copyDriveLink()}
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
