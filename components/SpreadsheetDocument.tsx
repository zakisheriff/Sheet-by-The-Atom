"use client";

import { useCallback, useEffect, useState } from "react";
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
import type { Viewport } from "@/hooks/useGrid";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useSpreadsheetStore } from "@/lib/store";

type SpreadsheetDocumentProps = {
  workbookId: string;
};

export function SpreadsheetDocument({ workbookId }: SpreadsheetDocumentProps) {
  const setWorkbookId = useSpreadsheetStore((state) => state.setWorkbookId);
  const markSaved = useSpreadsheetStore((state) => state.markSaved);
  const dirty = useSpreadsheetStore((state) => state.dirty);
  const importRows = useSpreadsheetStore((state) => state.importRows);
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
    const pending = window.localStorage.getItem("atom:pending-import");
    if (!pending) {
      return;
    }

    try {
      const workbook = JSON.parse(pending) as { name?: string; rows?: string[][] };
      if (Array.isArray(workbook.rows)) {
        importRows(workbook.rows, workbook.name ?? "Imported workbook");
        notify(`Imported ${workbook.name ?? "workbook"}`);
      }
    } finally {
      window.localStorage.removeItem("atom:pending-import");
    }
  }, [importRows, notify]);

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
      <header className="flex min-h-10 items-center justify-between gap-2 bg-[#217346] px-2 text-white sm:px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <button
            type="button"
            className="rounded bg-white/12 px-2 py-1 text-xs font-medium hover:bg-white/20"
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
            className="hidden h-7 w-56 items-center rounded bg-white/15 px-3 text-left text-xs text-white/80 hover:bg-white/20 md:flex"
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
