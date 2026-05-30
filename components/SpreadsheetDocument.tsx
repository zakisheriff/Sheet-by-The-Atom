"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CanvasGrid } from "./grid/Canvas";
import { CellEditor } from "./grid/CellEditor";
import { FormulaBar } from "./grid/FormulaBar";
import { SelectionOverlay } from "./grid/SelectionOverlay";
import { Toolbar } from "./toolbar/Toolbar";
import { PresenceBar } from "./collaboration/PresenceBar";
import { LiveCursor } from "./collaboration/LiveCursor";
import { SheetTabs } from "./sheets/SheetTabs";
import { CommandPalette } from "./CommandPalette";
import { FindReplaceDialog } from "./FindReplaceDialog";
import { StatusBar } from "./StatusBar";
import { useCollaboration } from "@/hooks/useCollaboration";
import { useDriveSync } from "@/hooks/useDriveSync";
import type { Viewport } from "@/hooks/useGrid";
import { useKeyboard } from "@/hooks/useKeyboard";
import type { Sheet } from "@/lib/grid";
import { useSpreadsheetStore } from "@/lib/store";

type SpreadsheetDocumentProps = {
  workbookId: string;
};

export function SpreadsheetDocument({ workbookId }: SpreadsheetDocumentProps) {
  const setWorkbookId = useSpreadsheetStore((state) => state.setWorkbookId);
  const markSaved = useSpreadsheetStore((state) => state.markSaved);
  const dirty = useSpreadsheetStore((state) => state.dirty);
  const importRows = useSpreadsheetStore((state) => state.importRows);
  const hydrateWorkbook = useSpreadsheetStore((state) => state.hydrateWorkbook);
  const setDriveState = useSpreadsheetStore((state) => state.setDriveState);
  const [viewport, setViewport] = useState<Viewport>({ width: 800, height: 500, scrollLeft: 0, scrollTop: 0 });
  const [findOpen, setFindOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const handleViewportChange = useCallback((nextViewport: Viewport) => {
    setViewport((current) =>
      current.width === nextViewport.width &&
      current.height === nextViewport.height &&
      current.scrollLeft === nextViewport.scrollLeft &&
      current.scrollTop === nextViewport.scrollTop
        ? current
        : nextViewport
    );
  }, []);
  const { presence } = useCollaboration(workbookId);
  useKeyboard();
  useDriveSync();

  const notify = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }, []);

  useEffect(() => {
    const openFind = () => setFindOpen(true);
    window.addEventListener("atom:open-find", openFind);
    return () => window.removeEventListener("atom:open-find", openFind);
  }, []);

  useEffect(() => {
    setWorkbookId(workbookId);
  }, [setWorkbookId, workbookId]);

  useEffect(() => {
    const pendingState = window.localStorage.getItem("atom:pending-workbook-state");
    if (pendingState) {
      try {
        const workbook = JSON.parse(pendingState) as {
          workbookId?: string;
          activeSheetId?: string;
          sheets?: Sheet[];
          driveFileId?: string;
          driveModifiedTime?: string;
          driveShareUrl?: string;
        };
        if (Array.isArray(workbook.sheets) && typeof workbook.activeSheetId === "string") {
          hydrateWorkbook({
            workbookId: workbook.workbookId,
            activeSheetId: workbook.activeSheetId,
            sheets: workbook.sheets
          });
          setDriveState({
            fileId: workbook.driveFileId,
            modifiedTime: workbook.driveModifiedTime,
            shareUrl: workbook.driveShareUrl,
            status: workbook.driveFileId ? "saved" : "local",
            error: null
          });
          notify("Opened shared Drive sheet");
        }
      } finally {
        window.localStorage.removeItem("atom:pending-workbook-state");
      }
      return;
    }

    const pending = window.localStorage.getItem("atom:pending-import");
    if (!pending) {
      return;
    }

    try {
      const workbook = JSON.parse(pending) as {
        name?: string;
        rows?: string[][];
        cells?: Sheet["cells"];
        rowHeights?: Sheet["rowHeights"];
        columnWidths?: Sheet["columnWidths"];
        mergedCells?: Sheet["mergedCells"];
      };
      if (Array.isArray(workbook.rows)) {
        importRows(workbook.rows, workbook.name ?? "Imported workbook", {
          cells: workbook.cells,
          rowHeights: workbook.rowHeights,
          columnWidths: workbook.columnWidths,
          mergedCells: workbook.mergedCells
        });
        notify(`Imported ${workbook.name ?? "workbook"}`);
      }
    } finally {
      window.localStorage.removeItem("atom:pending-import");
    }
  }, [hydrateWorkbook, importRows, notify, setDriveState]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (dirty) {
        markSaved();
      }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [dirty, markSaved]);

  return (
    <main className="flex h-dvh min-w-0 flex-col overflow-hidden bg-[#f3f4f2] text-neutral-950">
      <header className="flex min-h-12 items-center justify-between gap-2 bg-[#2F7D4D] px-2 text-white sm:px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 items-center gap-2 rounded-[18px] bg-white/12 px-3 text-xs font-bold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Back to start page"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Start</span>
          </Link>
          <button
            type="button"
            className="h-9 rounded-[18px] bg-white/12 px-3 text-xs font-bold hover:bg-white/20"
            onClick={() => notify("Autosave runs every 30 seconds")}
          >
            AutoSave off
          </button>
        </div>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-sm font-semibold">Financial Model</h1>
          <p className="hidden text-[10px] text-white/70 sm:block">{workbookId}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden h-9 w-64 items-center rounded-[18px] bg-white/15 px-4 text-left text-xs font-semibold text-white/80 hover:bg-white/20 md:flex"
            onClick={() => useSpreadsheetStore.getState().toggleCommandPalette(true)}
          >
            Search commands
          </button>
          <PresenceBar presence={presence} />
        </div>
      </header>
      <Toolbar onOpenFind={() => setFindOpen(true)} onNotify={notify} />
      <FormulaBar />
      <section className="relative flex min-h-0 flex-1 border-y border-neutral-300 bg-white">
        <CanvasGrid onViewportChange={handleViewportChange} />
        <CellEditor viewport={viewport} />
        <SelectionOverlay />
        {presence.map((participant) => (
          <LiveCursor key={participant.user.id} participant={participant} viewport={viewport} />
        ))}
      </section>
      <SheetTabs />
      <StatusBar />
      <CommandPalette onOpenFind={() => setFindOpen(true)} onNotify={notify} />
      <FindReplaceDialog open={findOpen} onClose={() => setFindOpen(false)} onNotify={notify} />
      {notice ? (
        <div className="fixed bottom-12 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white">
          {notice}
        </div>
      ) : null}
    </main>
  );
}
