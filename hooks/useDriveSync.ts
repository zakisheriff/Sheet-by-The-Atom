"use client";

import { useEffect, useRef } from "react";
import {
  createDriveShareUrl,
  fetchDriveFileMetadata,
  fetchWorkbookFromDrive,
  getGoogleDriveSession,
  saveWorkbookToDrive,
  type DriveWorkbookPayload
} from "@/lib/driveService";
import { useSpreadsheetStore } from "@/lib/store";

const POLL_INTERVAL_MS = 3_000;
const SAVE_DEBOUNCE_MS = 800;

function workbookTitle(workbookId: string, activeSheetName: string): string {
  return workbookId === "demo-workbook" ? "Financial Model" : activeSheetName || "Untitled Sheet";
}

export function useDriveSync() {
  const latestState = useRef(useSpreadsheetStore.getState());
  const saveInFlight = useRef(false);
  const pollInFlight = useRef(false);

  useEffect(() => {
    return useSpreadsheetStore.subscribe((state) => {
      latestState.current = state;
    });
  }, []);

  useEffect(() => {
    const onOffline = () => useSpreadsheetStore.getState().setDriveSyncStatus("offline");
    const onOnline = () => {
      const state = useSpreadsheetStore.getState();
      if (state.driveFileId) {
        state.setDriveSyncStatus(state.dirty ? "syncing" : "saved");
      }
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    let saveTimer: number | null = null;
    const unsubscribe = useSpreadsheetStore.subscribe((state) => {
      const session = getGoogleDriveSession();
      if (!state.driveFileId || !state.dirty || !session) {
        return;
      }

      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
      }

      state.setDriveSyncStatus(navigator.onLine ? "syncing" : "offline");
      saveTimer = window.setTimeout(() => {
        void saveCurrentWorkbook();
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
      }
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = latestState.current;
      if (!state.driveFileId || !getGoogleDriveSession() || saveInFlight.current || pollInFlight.current) {
        return;
      }

      void pollRemoteWorkbook();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  async function saveCurrentWorkbook() {
    const state = latestState.current;
    const session = getGoogleDriveSession();
    if (!state.driveFileId || !session || saveInFlight.current) {
      return;
    }

    if (!navigator.onLine) {
      state.setDriveSyncStatus("offline");
      return;
    }

    saveInFlight.current = true;
    state.setDriveSyncStatus("syncing");

    try {
      const remoteMetadata = await fetchDriveFileMetadata(state.driveFileId);
      if (
        state.driveModifiedTime &&
        remoteMetadata.modifiedTime !== state.driveModifiedTime &&
        new Date(remoteMetadata.modifiedTime).getTime() > new Date(state.driveModifiedTime).getTime()
      ) {
        console.warn("Drive conflict detected. Applying local last-write-wins save for now.");
      }

      const activeSheet = state.sheets.find((sheet) => sheet.id === state.activeSheetId) ?? state.sheets[0];
      const payload: DriveWorkbookPayload = {
        version: 1,
        workbook: {
          workbookId: state.workbookId,
          activeSheetId: state.activeSheetId,
          sheets: state.sheets
        },
        metadata: {
          title: workbookTitle(state.workbookId, activeSheet?.name ?? "Untitled Sheet"),
          lastModified: new Date().toISOString(),
          owner: session.profile.email
        }
      };

      const result = await saveWorkbookToDrive({
        fileId: state.driveFileId,
        title: payload.metadata.title,
        payload
      });
      useSpreadsheetStore.getState().setDriveState({
        fileId: result.fileId,
        modifiedTime: result.modifiedTime,
        shareUrl: result.shareUrl,
        status: "saved",
        error: null
      });
      useSpreadsheetStore.getState().markSaved();
    } catch (error) {
      useSpreadsheetStore.getState().setDriveSyncStatus("error", error instanceof Error ? error.message : "Drive sync failed");
    } finally {
      saveInFlight.current = false;
    }
  }

  async function pollRemoteWorkbook() {
    const state = latestState.current;
    if (!state.driveFileId || !navigator.onLine) {
      return;
    }

    pollInFlight.current = true;
    try {
      const metadata = await fetchDriveFileMetadata(state.driveFileId);
      if (!state.driveModifiedTime || metadata.modifiedTime === state.driveModifiedTime) {
        return;
      }

      if (state.dirty) {
        console.warn("Remote Drive changes found while local edits are dirty. Keeping local edits until autosave completes.");
        return;
      }

      const payload = await fetchWorkbookFromDrive(state.driveFileId);
      useSpreadsheetStore.getState().hydrateWorkbook({
        ...payload.workbook,
        workbookId: state.workbookId
      });
      useSpreadsheetStore.getState().setDriveState({
        fileId: state.driveFileId,
        modifiedTime: metadata.modifiedTime,
        shareUrl: state.driveShareUrl ?? createDriveShareUrl(state.driveFileId),
        status: "saved",
        error: null
      });
    } catch (error) {
      useSpreadsheetStore.getState().setDriveSyncStatus("error", error instanceof Error ? error.message : "Drive sync failed");
    } finally {
      pollInFlight.current = false;
    }
  }
}
