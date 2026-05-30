"use client";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const PROFILE_SCOPES = "openid profile email";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
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
