import { cookies } from "next/headers";

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
