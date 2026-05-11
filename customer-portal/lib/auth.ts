import { cookies } from "next/headers";
import { fleetbaseSession } from "./api-client";

const COOKIE_NAME = "fb_session_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function setAuthToken(token: string) {
  const cookieStore = await cookies();
  const secureCookie = process.env.COOKIE_SECURE !== "false";
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

export async function clearAuthToken() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Validate the session token against the Fleetbase backend. If the backend
 * rejects it (e.g. customer was deleted, deactivated, or had credentials
 * reset), clear the local cookie so the browser stops sending the dead
 * token and the UI can redirect to /login cleanly.
 */
export async function requireValidSession(): Promise<
  | { token: string; user: string; type: string; verified: boolean }
  | null
> {
  const token = await getAuthToken();
  if (!token) return null;

  const session = await fleetbaseSession(token);
  if (!session.ok) {
    await clearAuthToken();
    return null;
  }

  return { ...session.data, token };
}
