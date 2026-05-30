"use client";

import { motion } from "framer-motion";
import { Calculator, Download, FileSearch, Plus, Save, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { rangeLabel } from "@/lib/grid";
import { useSpreadsheetStore } from "@/lib/store";

const commands = [
  { id: "save", name: "Save workbook", icon: Save },
  { id: "find", name: "Find and replace", icon: FileSearch },
  { id: "sheet", name: "Add sheet", icon: Plus },
  { id: "formula", name: "Insert SUM formula", icon: Calculator },
  { id: "export", name: "Export active sheet CSV", icon: Download },
  { id: "quick", name: "Quick analysis formula", icon: Sparkles }
] as const;

type CommandPaletteProps = {
  onOpenFind: () => void;
  onNotify: (message: string) => void;
};

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CommandPalette({ onOpenFind, onNotify }: CommandPaletteProps) {
  const open = useSpreadsheetStore((state) => state.commandPaletteOpen);
  const toggleCommandPalette = useSpreadsheetStore((state) => state.toggleCommandPalette);
  const addSheet = useSpreadsheetStore((state) => state.addSheet);
  const markSaved = useSpreadsheetStore((state) => state.markSaved);
  const selection = useSpreadsheetStore((state) => state.selection);
  const setCellInput = useSpreadsheetStore((state) => state.setCellInput);
  const exportActiveSheetCsv = useSpreadsheetStore((state) => state.exportActiveSheetCsv);
  const activeSheet = useSpreadsheetStore((state) => state.getActiveSheet());
  const [query, setQuery] = useState("");

  if (!open) {
    return null;
  }

  const filtered = commands.filter((command) => command.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/10" onMouseDown={() => toggleCommandPalette(false)}>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="mx-auto mt-24 w-full max-w-xl rounded-[20px] border border-neutral-200 bg-white"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 px-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                toggleCommandPalette(false);
              }
            }}
            className="h-11 flex-1 outline-none"
            aria-label="Command palette"
            placeholder="Search commands"
          />
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded text-neutral-500 hover:bg-neutral-100"
            onClick={() => toggleCommandPalette(false)}
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-2">
          {filtered.map((command) => {
            const Icon = command.icon;
            return (
              <button
                key={command.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-blue-50"
                onClick={() => {
                  if (command.id === "save") {
                    markSaved();
                    onNotify("Workbook saved");
                  } else if (command.id === "find") {
                    onOpenFind();
                  } else if (command.id === "sheet") {
                    addSheet();
                    onNotify("Added sheet");
                  } else if (command.id === "formula") {
                    setCellInput(selection.end, `=SUM(${rangeLabel(selection)})`);
                    onNotify(`Inserted SUM for ${rangeLabel(selection)}`);
                  } else if (command.id === "export") {
                    downloadText(`${activeSheet.name}.csv`, exportActiveSheetCsv());
                    onNotify(`Exported ${activeSheet.name}.csv`);
                  } else if (command.id === "quick") {
                    setCellInput(selection.end, `=AVERAGE(${rangeLabel(selection)})`);
                    onNotify(`Inserted average for ${rangeLabel(selection)}`);
                  }
                  toggleCommandPalette(false);
                }}
              >
                <Icon className="h-4 w-4 text-neutral-500" />
                {command.name}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
