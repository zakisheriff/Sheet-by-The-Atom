"use client";

import { useEffect, useMemo, useState } from "react";
import type { PresenceState } from "@/lib/yjs";
import { createCollaborationSession, getPresenceStates, setLocalCursor } from "@/lib/yjs";
import { useSpreadsheetStore } from "@/lib/store";

export function useCollaboration(workbookId: string) {
  const selection = useSpreadsheetStore((state) => state.selection);
  const session = useMemo(() => createCollaborationSession(workbookId), [workbookId]);
  const [presence, setPresence] = useState<PresenceState[]>([]);

  useEffect(() => {
    const awareness = session.provider.awareness;
    const updatePresence = () => setPresence(getPresenceStates(session));
    awareness.on("change", updatePresence);
    updatePresence();
    session.provider.connect();

    return () => {
      awareness.off("change", updatePresence);
      session.provider.disconnect();
      session.doc.destroy();
    };
  }, [session]);

  useEffect(() => {
    setLocalCursor(session, selection.end);
  }, [selection.end, session]);

  return { session, presence };
}
