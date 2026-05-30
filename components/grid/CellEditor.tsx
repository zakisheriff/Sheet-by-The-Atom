"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Viewport } from "@/hooks/useGrid";
import { GRID, columnOffset, columnWidth, rowHeight, rowOffset } from "@/lib/grid";
import type { Sheet } from "@/lib/grid";
import { getFormulaSuggestions } from "@/lib/hyperformula";
import { useSpreadsheetStore } from "@/lib/store";

type CellEditorProps = {
  viewport: Viewport;
};

function editorPosition(sheet: Sheet, row: number, col: number, viewport: Viewport) {
  const frozenCol = col < GRID.frozenColumns;
  const frozenRow = row < GRID.frozenRows;
  return {
    left: GRID.rowHeaderWidth + columnOffset(sheet, col) - (frozenCol ? 0 : viewport.scrollLeft),
    top: GRID.columnHeaderHeight + rowOffset(sheet, row) - (frozenRow ? 0 : viewport.scrollTop),
    width: columnWidth(sheet, col),
    height: rowHeight(sheet, row)
  };
}

export function CellEditor({ viewport }: CellEditorProps) {
  const editMode = useSpreadsheetStore((state) => state.editMode);
  const setEditInput = useSpreadsheetStore((state) => state.setEditInput);
  const commitEdit = useSpreadsheetStore((state) => state.commitEdit);
  const cancelEdit = useSpreadsheetStore((state) => state.cancelEdit);
  const sheet = useSpreadsheetStore((state) => state.getActiveSheet());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0);

  useEffect(() => {
    if (!editMode) {
      return;
    }
    setHighlightedSuggestion(0);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [editMode]);

  const position = useMemo(() => {
    if (!editMode) {
      return null;
    }
    return editorPosition(sheet, editMode.address.row, editMode.address.col, viewport);
  }, [editMode, sheet, viewport]);

  if (!editMode || !position) {
    return null;
  }

  const value = editMode.currentValue;
  const suggestions = value.startsWith("=") ? getFormulaSuggestions(value.slice(1)).slice(0, 6) : [];
  const applySuggestion = (suggestion: string) => {
    setEditInput(`=${suggestion}(`);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="absolute z-30" style={{ left: position.left, top: position.top }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setEditInput(event.target.value)}
        onBlur={() => commitEdit(value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancelEdit();
          } else if (suggestions.length > 0 && event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedSuggestion((index) => (index + 1) % suggestions.length);
          } else if (suggestions.length > 0 && event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedSuggestion((index) => (index - 1 + suggestions.length) % suggestions.length);
          } else if (suggestions.length > 0 && event.key === "Enter") {
            event.preventDefault();
            applySuggestion(suggestions[highlightedSuggestion] ?? suggestions[0]);
          } else if (event.key === "Enter") {
            event.preventDefault();
            commitEdit(value, { row: editMode.address.row + 1, col: editMode.address.col });
          } else if (event.key === "Tab") {
            event.preventDefault();
            if (suggestions.length > 0) {
              applySuggestion(suggestions[highlightedSuggestion] ?? suggestions[0]);
              return;
            }
            commitEdit(value, { row: editMode.address.row, col: editMode.address.col + 1 });
          }
        }}
        className="rounded-none border-2 border-accent bg-white px-2 font-mono text-xs text-neutral-950 outline-none"
        style={{
          width: position.width,
          height: position.height
        }}
        aria-label="Cell editor"
        aria-autocomplete="list"
      />
      {suggestions.length > 0 ? (
        <div className="mt-1 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 text-xs shadow-lg">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              className={
                index === highlightedSuggestion
                  ? "flex w-full items-center justify-between bg-blue-50 px-3 py-2 text-left text-[#0066FF]"
                  : "flex w-full items-center justify-between px-3 py-2 text-left text-neutral-700 hover:bg-blue-50"
              }
              onMouseDown={(event) => {
                event.preventDefault();
                applySuggestion(suggestion);
              }}
            >
              <span className="font-semibold">{suggestion}</span>
              <span className="text-neutral-400">fx</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
