import { NextResponse } from "next/server";
import { getAuthToken, clearAuthToken } from "@/lib/auth";
import { fleetbaseLogout } from "@/lib/api-client";

export async function POST() {
  const token = await getAuthToken();

  if (token) {
    await fleetbaseLogout(token).catch(() => {});
  }

  await clearAuthToken();

  return NextResponse.json({ ok: true });
}
