"use client";

import type { Viewport } from "@/hooks/useGrid";
import { GRID, addressLabel, columnOffset, columnWidth, rowHeight, rowOffset } from "@/lib/grid";
import { useSpreadsheetStore } from "@/lib/store";
import type { PresenceState } from "@/lib/yjs";

type LiveCursorProps = {
  participant: PresenceState;
  viewport: Viewport;
};

export function LiveCursor({ participant, viewport }: LiveCursorProps) {
  const sheet = useSpreadsheetStore((state) => state.getActiveSheet());

  if (!participant.cursor) {
    return null;
  }

  const frozenCol = participant.cursor.col < GRID.frozenColumns;
  const frozenRow = participant.cursor.row < GRID.frozenRows;
  const left = GRID.rowHeaderWidth + columnOffset(sheet, participant.cursor.col) - (frozenCol ? 0 : viewport.scrollLeft);
  const top = GRID.columnHeaderHeight + rowOffset(sheet, participant.cursor.row) - (frozenRow ? 0 : viewport.scrollTop);

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left,
        top,
        width: columnWidth(sheet, participant.cursor.col),
        height: rowHeight(sheet, participant.cursor.row),
        border: `2px solid ${participant.user.color}`
      }}
      aria-label={`${participant.user.name} at ${addressLabel(participant.cursor)}`}
    >
      <span
        className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: participant.user.color }}
      >
        {participant.user.name}
      </span>
    </div>
  );
}
