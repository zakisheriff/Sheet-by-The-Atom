"use client";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { CellAddress } from "./grid";

export type AwarenessUser = {
  id: string;
  name: string;
  color: string;
};

export type PresenceState = {
  user: AwarenessUser;
  cursor?: CellAddress;
};

export type CollaborationSession = {
  doc: Y.Doc;
  provider: WebsocketProvider;
  cells: Y.Map<string>;
};

const userColors = ["#0066FF", "#34C759", "#FF9500", "#AF52DE", "#FF2D55"];

function makeUser(): AwarenessUser {
  const id = crypto.randomUUID();
  return {
    id,
    name: `User ${id.slice(0, 4).toUpperCase()}`,
    color: userColors[Math.floor(Math.random() * userColors.length)]
  };
}

export function createCollaborationSession(workbookId: string): CollaborationSession {
  const doc = new Y.Doc();
  const wsUrl = process.env.NEXT_PUBLIC_YJS_WEBSOCKET_URL ?? "ws://localhost:1234";
  const provider = new WebsocketProvider(wsUrl, workbookId, doc, { connect: false });
  provider.awareness.setLocalStateField("user", makeUser());

  return {
    doc,
    provider,
    cells: doc.getMap("cells")
  };
}

export function setLocalCursor(session: CollaborationSession, cursor: CellAddress): void {
  session.provider.awareness.setLocalStateField("cursor", cursor);
}

export function getPresenceStates(session: CollaborationSession): PresenceState[] {
  const states = Array.from(session.provider.awareness.getStates().values());
  return states.flatMap((state) => {
    const user = state.user as AwarenessUser | undefined;
    const cursor = state.cursor as CellAddress | undefined;
    return user ? [{ user, cursor }] : [];
  });
}
