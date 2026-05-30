"use client";

import { useEffect } from "react";
import { useSpreadsheetStore } from "@/lib/store";

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable ||
    target.closest("[role='dialog']") !== null
  );
}

export function useKeyboard() {
  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      const state = useSpreadsheetStore.getState();
      const isMeta = event.metaKey || event.ctrlKey;

      if (state.editMode) {
        return;
      }

      const shift = event.shiftKey;

      if (isMeta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        state.toggleCommandPalette(true);
        return;
      }

      if (isTextEntryTarget(event.target)) {
        return;
      }

      if (isMeta && event.key.toLowerCase() === "a") {
        event.preventDefault();
        state.selectAll();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (shift) {
          state.redo();
        } else {
          state.undo();
        }
        return;
      }

      if (isMeta && event.key.toLowerCase() === "c") {
        event.preventDefault();
        const text = state.copySelection();
        await navigator.clipboard.writeText(text);
        return;
      }

      if (isMeta && event.key.toLowerCase() === "v") {
        event.preventDefault();
        const text = await navigator.clipboard.readText();
        state.pasteAtSelection(text);
        return;
      }

      if (isMeta && event.key.toLowerCase() === "f") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("atom:open-find"));
        return;
      }

      if (event.ctrlKey && shift && event.key === "End") {
        event.preventDefault();
        const sheet = state.getActiveSheet();
        const used = Object.keys(sheet.cells).map((key) => {
          const [row, col] = key.split(":").map((part) => Number.parseInt(part, 10));
          return { row, col };
        });
        const last = used.reduce(
          (max, address) => ({
            row: Math.max(max.row, address.row),
            col: Math.max(max.col, address.col)
          }),
          { row: 0, col: 0 }
        );
        state.selectCell(last);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        state.moveSelection({ row: -1, col: 0 }, shift);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        state.moveSelection({ row: 1, col: 0 }, shift);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        state.moveSelection({ row: 0, col: -1 }, shift);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        state.moveSelection({ row: 0, col: 1 }, shift);
      } else if (event.key === "Enter") {
        event.preventDefault();
        state.beginEdit(state.selection.end);
      } else if (event.key === "Tab") {
        event.preventDefault();
        state.moveSelection({ row: 0, col: 1 }, shift);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        state.clearSelection();
      } else if (event.key.length === 1 && !isMeta) {
        event.preventDefault();
        state.beginEdit(state.selection.end, event.key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
