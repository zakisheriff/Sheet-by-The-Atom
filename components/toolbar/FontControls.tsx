"use client";

import { useState } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { cellKey, createEmptyCell } from "@/lib/grid";
import { useSpreadsheetStore } from "@/lib/store";

const fontFamilies = ["Inter", "SFMono-Regular", "Arial", "Georgia"];

export function FontControls() {
  const applyStyle = useSpreadsheetStore((state) => state.applyStyle);
  const selection = useSpreadsheetStore((state) => state.selection);
  const sheets = useSpreadsheetStore((state) => state.sheets);
  const activeSheetId = useSpreadsheetStore((state) => state.activeSheetId);
  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId) ?? sheets[0];
  const cell = activeSheet.cells[cellKey(selection.end)] ?? createEmptyCell();
  const [fontSize, setFontSize] = useState(12);

  return (
    <div className="flex items-center gap-1 border-r border-neutral-200 pr-2">
      <select
        className="h-7 w-32 rounded border border-neutral-200 bg-white px-2 text-xs outline-none focus:border-accent"
        aria-label="Font family"
        onChange={(event) => applyStyle({ fontFamily: event.target.value })}
        defaultValue="SFMono-Regular"
      >
        {fontFamilies.map((family) => (
          <option key={family} value={family}>
            {family}
          </option>
        ))}
      </select>
      <input
        className="h-7 w-14 rounded border border-neutral-200 px-2 text-xs outline-none focus:border-accent"
        aria-label="Font size"
        type="number"
        min={8}
        max={72}
        value={fontSize}
        onChange={(event) => {
          const nextSize = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(nextSize)) {
            setFontSize(nextSize);
            applyStyle({ fontSize: nextSize });
          }
        }}
      />
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded text-neutral-700 transition hover:bg-neutral-100"
        onClick={() => applyStyle({ bold: !cell.style.bold })}
        aria-label="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded text-neutral-700 transition hover:bg-neutral-100"
        onClick={() => applyStyle({ italic: !cell.style.italic })}
        aria-label="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded text-neutral-700 transition hover:bg-neutral-100"
        onClick={() => applyStyle({ underline: !cell.style.underline })}
        aria-label="Underline"
      >
        <Underline className="h-4 w-4" />
      </button>
    </div>
  );
}
