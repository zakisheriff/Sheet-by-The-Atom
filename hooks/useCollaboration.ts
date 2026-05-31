"use client";

import { useEffect, useMemo, useState } from "react";
import type { PresenceState } from "@/lib/yjs";
import {
  createCollaborationSession,
  getPresenceStates,
  getSharedWorkbookState,
  setLocalCursor,
  setSharedWorkbookState
} from "@/lib/yjs";
import { useSpreadsheetStore } from "@/lib/store";
import type { Sheet } from "@/lib/grid";

export function useCollaboration(workbookId: string) {
  const selection = useSpreadsheetStore((state) => state.selection);
  const hydrateWorkbook = useSpreadsheetStore((state) => state.hydrateWorkbook);
  const session = useMemo(() => createCollaborationSession(workbookId), [workbookId]);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [remoteApplying, setRemoteApplying] = useState(false);

  useEffect(() => {
    const awareness = session.provider.awareness;
    const updatePresence = () => setPresence(getPresenceStates(session));
    awareness.on("change", updatePresence);
    updatePresence();
    if (session.online) {
      session.provider.connect();
    }

    return () => {
      awareness.off("change", updatePresence);
      if (session.online) {
        session.provider.disconnect();
      }
      session.doc.destroy();
    };
  }, [session]);

  useEffect(() => {
    if (!session.online) {
      return;
    }

    let applyingRemote = false;
    let lastSignature = "";

    const signatureFor = (state: { activeSheetId: string; sheets: Sheet[] }) =>
      JSON.stringify({ activeSheetId: state.activeSheetId, sheets: state.sheets });

    const applyRemoteState = () => {
      const remoteState = getSharedWorkbookState(session);
      if (!remoteState) {
        return;
      }

      const signature = signatureFor(remoteState);
      if (signature === lastSignature) {
        return;
      }

      applyingRemote = true;
      setRemoteApplying(true);
      lastSignature = signature;
      hydrateWorkbook({
        ...remoteState,
        workbookId
      });
      window.setTimeout(() => {
        applyingRemote = false;
        setRemoteApplying(false);
      }, 0);
    };

    if (session.workbook.has("state")) {
      applyRemoteState();
    } else {
      const { activeSheetId, sheets } = useSpreadsheetStore.getState();
      const localState = { activeSheetId, sheets };
      lastSignature = signatureFor(localState);
      setSharedWorkbookState(session, localState);
    }

    session.workbook.observe(applyRemoteState);

    const unsubscribe = useSpreadsheetStore.subscribe((state) => {
      if (applyingRemote) {
        return;
      }

      const nextState = { activeSheetId: state.activeSheetId, sheets: state.sheets };
      const nextSignature = signatureFor(nextState);
      if (nextSignature === lastSignature) {
        return;
      }

      lastSignature = nextSignature;
      setSharedWorkbookState(session, nextState);
    });

    return () => {
      session.workbook.unobserve(applyRemoteState);
      unsubscribe();
    };
  }, [hydrateWorkbook, session, workbookId]);

  useEffect(() => {
    setLocalCursor(session, selection.end);
  }, [selection.end, session]);

  return { session, presence, remoteApplying };
}
