"use client";

import type { CellData, CellRange, Sheet } from "./grid";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const PROFILE_SCOPES = "openid profile email";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_PERMISSIONS_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export type GoogleDriveProfile = {
  name: string;
  email: string;
  picture?: string;
};

export type GoogleDriveSession = {
  accessToken: string;
  expiresAt: number;
  profile: GoogleDriveProfile;
};

export type DriveWorkbookPayload = {
  version: 1;
  workbook: DriveWorkbookState;
  metadata: {
    title: string;
    lastModified: string;
    owner: string;
  };
};

export type DriveWorkbookState = {
  workbookId: string;
  activeSheetId: string;
  sheets: Sheet[];
};

export type DriveSaveResult = {
  fileId: string;
  name: string;
  modifiedTime: string;
  shareUrl: string;
};

export type DriveFileMetadata = {
  modifiedTime: string;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (options?: { prompt?: "" | "consent" | "select_account" }) => void;
  callback: (response: TokenResponse) => void;
};

type GoogleAccountsOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => TokenClient;
};

type GoogleIdentityServices = {
  accounts?: {
    oauth2?: GoogleAccountsOAuth2;
  };
};

type DriveFileResponse = {
  id?: string;
  name?: string;
  modifiedTime?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberMap(value: unknown): Record<number, number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [Number.parseInt(key, 10), typeof entry === "number" && Number.isFinite(entry) ? entry : null] as const)
      .filter((entry): entry is readonly [number, number] => Number.isFinite(entry[0]) && entry[1] !== null)
  );
}

function cellDataMap(value: unknown): Record<string, CellData> {
  if (!isRecord(value)) {
    return {};
  }

  const cells: Record<string, CellData> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!/^\d+:\d+$/.test(key) || !isRecord(entry)) {
      continue;
    }

    cells[key] = {
      value:
        typeof entry.value === "string" ||
        typeof entry.value === "number" ||
        typeof entry.value === "boolean" ||
        entry.value === null
          ? entry.value
          : "",
      displayValue: typeof entry.displayValue === "string" ? entry.displayValue : "",
      formula: typeof entry.formula === "string" ? entry.formula : undefined,
      format: isRecord(entry.format)
        ? {
            kind:
              entry.format.kind === "number" ||
              entry.format.kind === "formula" ||
              entry.format.kind === "date" ||
              entry.format.kind === "boolean" ||
              entry.format.kind === "currency"
                ? entry.format.kind
                : "text",
            numberFormat:
              entry.format.numberFormat === "currency" ||
              entry.format.numberFormat === "percent" ||
              entry.format.numberFormat === "decimal"
                ? entry.format.numberFormat
                : "plain",
            currencySymbol: typeof entry.format.currencySymbol === "string" ? entry.format.currencySymbol : undefined
          }
        : { kind: "text", numberFormat: "plain" },
      style: isRecord(entry.style) ? entry.style : {},
      error: typeof entry.error === "string" ? entry.error : undefined
    };
  }

  return cells;
}

function addressFromUnknown(value: unknown): { row: number; col: number } | null {
  if (!isRecord(value) || typeof value.row !== "number" || typeof value.col !== "number") {
    return null;
  }

  return Number.isFinite(value.row) && Number.isFinite(value.col)
    ? { row: Math.max(0, Math.floor(value.row)), col: Math.max(0, Math.floor(value.col)) }
    : null;
}

function mergedCells(value: unknown): CellRange[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const start = addressFromUnknown(entry.start);
    const end = addressFromUnknown(entry.end);
    return start && end ? [{ start, end }] : [];
  });
}

function sanitizeSheet(value: unknown, index: number): Sheet | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = stringOr(value.id, `sheet-${index + 1}`);
  return {
    id,
    name: stringOr(value.name, `Sheet ${index + 1}`),
    cells: cellDataMap(value.cells),
    rowHeights: numberMap(value.rowHeights),
    columnWidths: numberMap(value.columnWidths),
    mergedCells: mergedCells(value.mergedCells)
  };
}

function sanitizeDriveWorkbookPayload(value: unknown): DriveWorkbookPayload {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.workbook)) {
    throw new Error("This Drive file is not a valid Atom Sheets workbook.");
  }

  const sheets = Array.isArray(value.workbook.sheets)
    ? value.workbook.sheets.flatMap((sheet, index) => sanitizeSheet(sheet, index) ?? [])
    : [];

  if (sheets.length === 0) {
    throw new Error("This Drive workbook does not contain any sheets.");
  }

  const activeSheetId = stringOr(value.workbook.activeSheetId, sheets[0].id);

  return {
    version: 1,
    workbook: {
      workbookId: stringOr(value.workbook.workbookId, "drive-workbook"),
      activeSheetId: sheets.some((sheet) => sheet.id === activeSheetId) ? activeSheetId : sheets[0].id,
      sheets
    },
    metadata: isRecord(value.metadata)
      ? {
          title: stringOr(value.metadata.title, "Untitled Sheet"),
          lastModified: stringOr(value.metadata.lastModified, new Date().toISOString()),
          owner: typeof value.metadata.owner === "string" ? value.metadata.owner : ""
        }
      : {
          title: "Untitled Sheet",
          lastModified: new Date().toISOString(),
          owner: ""
        }
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

let tokenClient: TokenClient | null = null;
let currentSession: GoogleDriveSession | null = null;
let pendingSignIn: Promise<GoogleDriveSession> | null = null;

function getClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Google Drive sign-in needs NEXT_PUBLIC_GOOGLE_CLIENT_ID configured.");
  }
  return clientId;
}

function waitForGoogleIdentityServices(): Promise<GoogleAccountsOAuth2> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timeoutMs = 10_000;

    const check = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) {
        resolve(oauth2);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("Google sign-in script did not load. Check your connection and try again."));
        return;
      }

      window.setTimeout(check, 50);
    };

    check();
  });
}

async function fetchGoogleProfile(accessToken: string): Promise<GoogleDriveProfile> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("Signed in, but Google profile could not be loaded.");
  }

  const profile = (await response.json()) as Partial<GoogleDriveProfile>;
  return {
    name: typeof profile.name === "string" && profile.name.trim() ? profile.name : "Google user",
    email: typeof profile.email === "string" ? profile.email : "",
    picture: typeof profile.picture === "string" ? profile.picture : undefined
  };
}

async function getTokenClient(): Promise<TokenClient> {
  if (tokenClient) {
    return tokenClient;
  }

  const oauth2 = await waitForGoogleIdentityServices();
  tokenClient = oauth2.initTokenClient({
    client_id: getClientId(),
    scope: `${DRIVE_FILE_SCOPE} ${PROFILE_SCOPES}`,
    callback: () => undefined,
    error_callback: (error) => {
      throw new Error(error.message || error.type || "Google sign-in failed.");
    }
  });

  return tokenClient;
}

function isSessionFresh(session: GoogleDriveSession | null): session is GoogleDriveSession {
  return Boolean(session && session.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now());
}

export function getGoogleDriveSession(): GoogleDriveSession | null {
  return isSessionFresh(currentSession) ? currentSession : null;
}

export async function signInToGoogleDrive(options: { prompt?: "" | "consent" | "select_account" } = {}): Promise<GoogleDriveSession> {
  if (isSessionFresh(currentSession)) {
    return currentSession;
  }

  if (pendingSignIn) {
    return pendingSignIn;
  }

  pendingSignIn = new Promise<GoogleDriveSession>(async (resolve, reject) => {
    try {
      const client = await getTokenClient();
      client.callback = async (response) => {
        try {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }

          if (!response.access_token) {
            reject(new Error("Google did not return an access token."));
            return;
          }

          const profile = await fetchGoogleProfile(response.access_token);
          const expiresInMs = (response.expires_in ?? 3600) * 1000;
          currentSession = {
            accessToken: response.access_token,
            expiresAt: Date.now() + expiresInMs,
            profile
          };
          resolve(currentSession);
        } catch (error) {
          reject(error);
        }
      };
      client.requestAccessToken({ prompt: options.prompt ?? "consent" });
    } catch (error) {
      reject(error);
    }
  }).finally(() => {
    pendingSignIn = null;
  });

  return pendingSignIn;
}

export async function getFreshGoogleDriveAccessToken(): Promise<string> {
  const session = await signInToGoogleDrive({ prompt: currentSession ? "" : "consent" });
  return session.accessToken;
}

export function validateDriveFileId(fileId: string): boolean {
  return /^[A-Za-z0-9_-]{10,100}$/.test(fileId);
}

export function createDriveShareUrl(fileId: string): string {
  if (typeof window === "undefined") {
    return `/?file=${encodeURIComponent(fileId)}`;
  }

  return `${window.location.origin}/?file=${encodeURIComponent(fileId)}`;
}

async function driveRequest(url: string, init: RequestInit): Promise<Response> {
  const accessToken = await getFreshGoogleDriveAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (response.status === 401) {
    currentSession = null;
    const retryToken = await getFreshGoogleDriveAccessToken();
    headers.set("Authorization", `Bearer ${retryToken}`);
    return fetch(url, {
      ...init,
      headers
    });
  }

  return response;
}

function multipartBody(metadata: Record<string, string>, payload: DriveWorkbookPayload): { body: Blob; contentType: string } {
  const boundary = `atom_sheets_${crypto.randomUUID()}`;
  const delimiter = `--${boundary}`;
  const closeDelimiter = `--${boundary}--`;
  const body = new Blob(
    [
      `${delimiter}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata),
      "\r\n",
      `${delimiter}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(payload),
      "\r\n",
      closeDelimiter
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

function parseDriveFileResponse(response: DriveFileResponse, fallbackName: string): DriveSaveResult {
  if (!response.id || !validateDriveFileId(response.id)) {
    throw new Error("Google Drive did not return a valid file id.");
  }

  return {
    fileId: response.id,
    name: response.name ?? fallbackName,
    modifiedTime: response.modifiedTime ?? new Date().toISOString(),
    shareUrl: createDriveShareUrl(response.id)
  };
}

async function enableAnyoneWithLinkEditing(fileId: string): Promise<void> {
  const response = await driveRequest(
    `${DRIVE_PERMISSIONS_ENDPOINT}/${encodeURIComponent(fileId)}/permissions?fields=id`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        role: "writer",
        type: "anyone"
      })
    }
  );

  if (response.status === 400 || response.status === 403) {
    console.warn("Drive link editing permission could not be applied. Users may need file access from Drive.", response.status);
    return;
  }

  if (!response.ok) {
    console.warn("Drive link editing permission failed.", response.status);
  }
}

export async function saveWorkbookToDrive(params: {
  fileId?: string | null;
  title: string;
  payload: DriveWorkbookPayload;
}): Promise<DriveSaveResult> {
  if (params.fileId && !validateDriveFileId(params.fileId)) {
    throw new Error("Invalid Google Drive file id.");
  }

  const filename = `${params.title.trim() || "Untitled Sheet"}.atom-sheet.json`;
  const metadata = {
    name: filename,
    mimeType: "application/json"
  };
  const multipart = multipartBody(metadata, params.payload);
  const query = "uploadType=multipart&fields=id,name,modifiedTime";
  const url = params.fileId
    ? `${DRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(params.fileId)}?${query}`
    : `${DRIVE_UPLOAD_ENDPOINT}?${query}`;

  const response = await driveRequest(url, {
    method: params.fileId ? "PATCH" : "POST",
    headers: {
      "Content-Type": multipart.contentType
    },
    body: multipart.body
  });

  if (response.status === 403) {
    throw new Error("You don't have access to save this sheet to Google Drive.");
  }

  if (!response.ok) {
    throw new Error(`Google Drive save failed (${response.status}).`);
  }

  const result = parseDriveFileResponse((await response.json()) as DriveFileResponse, filename);
  await enableAnyoneWithLinkEditing(result.fileId);
  return result;
}

export async function fetchDriveFileMetadata(fileId: string): Promise<DriveFileMetadata> {
  if (!validateDriveFileId(fileId)) {
    throw new Error("Invalid Google Drive file id.");
  }

  const response = await driveRequest(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?fields=modifiedTime`,
    { method: "GET" }
  );

  if (response.status === 404) {
    throw new Error("This sheet no longer exists or access was removed.");
  }

  if (response.status === 403) {
    throw new Error("You don't have access to this sheet. Request access from the owner.");
  }

  if (!response.ok) {
    throw new Error(`Google Drive metadata check failed (${response.status}).`);
  }

  const metadata = (await response.json()) as Partial<DriveFileMetadata>;
  if (!metadata.modifiedTime) {
    throw new Error("Google Drive did not return a modified time.");
  }

  return { modifiedTime: metadata.modifiedTime };
}

export async function fetchWorkbookFromDrive(fileId: string): Promise<DriveWorkbookPayload> {
  if (!validateDriveFileId(fileId)) {
    throw new Error("Invalid Google Drive file id.");
  }

  const response = await driveRequest(`${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?alt=media`, {
    method: "GET"
  });

  if (response.status === 404) {
    throw new Error("This sheet no longer exists or access was removed.");
  }

  if (response.status === 403) {
    throw new Error("You don't have access to this sheet. Request access from the owner.");
  }

  if (!response.ok) {
    throw new Error(`Google Drive open failed (${response.status}).`);
  }

  return sanitizeDriveWorkbookPayload(await response.json());
}
