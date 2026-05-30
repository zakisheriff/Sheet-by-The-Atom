"use client";

import { AlignCenter, AlignLeft, AlignRight, PaintBucket, Percent, Pipette } from "lucide-react";
import { useSpreadsheetStore } from "@/lib/store";

const swatches = ["#171717", "#0066FF", "#34C759", "#FF9500", "#D70015"];
const fills = ["#FFFFFF", "#EAF2FF", "#EAF8EF", "#FFF4E5", "#FFECEF"];

export function FormatControls() {
  const applyStyle = useSpreadsheetStore((state) => state.applyStyle);
  const applyNumberFormat = useSpreadsheetStore((state) => state.applyNumberFormat);

  return (
    <div className="flex items-center gap-1 border-r border-neutral-200 pr-2">
      <div className="flex items-center gap-1 rounded border border-neutral-200 px-1 py-0.5">
        <Pipette className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
        {swatches.map((color) => (
          <button
            key={color}
            type="button"
            className="h-5 w-5 rounded border border-neutral-200"
            style={{ backgroundColor: color }}
            onClick={() => applyStyle({ textColor: color })}
            aria-label={`Text color ${color}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-1 rounded border border-neutral-200 px-1 py-0.5">
        <PaintBucket className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
        {fills.map((color) => (
          <button
            key={color}
            type="button"
            className="h-5 w-5 rounded border border-neutral-200"
            style={{ backgroundColor: color }}
            onClick={() => applyStyle({ fillColor: color })}
            aria-label={`Fill color ${color}`}
          />
        ))}
      </div>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded text-neutral-700 transition hover:bg-neutral-100"
        onClick={() => applyStyle({ align: "left" })}
        aria-label="Align left"
      >
        <AlignLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded text-neutral-700 transition hover:bg-neutral-100"
        onClick={() => applyStyle({ align: "center" })}
        aria-label="Align center"
      >
        <AlignCenter className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded text-neutral-700 transition hover:bg-neutral-100"
        onClick={() => applyStyle({ align: "right" })}
        aria-label="Align right"
      >
        <AlignRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded text-neutral-700 transition hover:bg-neutral-100"
        onClick={() => applyNumberFormat("currency")}
        aria-label="Currency format"
      >
        $
      </button>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded text-neutral-700 transition hover:bg-neutral-100"
        onClick={() => applyNumberFormat("decimal")}
        aria-label="Decimal format"
      >
        .0
      </button>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded text-neutral-700 transition hover:bg-neutral-100"
        onClick={() => applyNumberFormat("percent")}
        aria-label="Percent format"
      >
        <Percent className="h-4 w-4" />
      </button>
    </div>
  );
}
