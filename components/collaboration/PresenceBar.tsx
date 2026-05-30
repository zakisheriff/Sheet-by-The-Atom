"use client";

import type { PresenceState } from "@/lib/yjs";

type PresenceBarProps = {
  presence: PresenceState[];
};

export function PresenceBar({ presence }: PresenceBarProps) {
  return (
    <div className="flex items-center gap-2">
      {presence.slice(0, 5).map((participant) => (
        <div
          key={participant.user.id}
          className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: participant.user.color }}
          title={participant.user.name}
          aria-label={participant.user.name}
        >
          {participant.user.name.slice(0, 1)}
        </div>
      ))}
    </div>
  );
}
