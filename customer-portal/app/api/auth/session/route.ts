import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { fleetbaseSession } from "@/lib/api-client";

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const result = await fleetbaseSession(token);

  if (!result.ok) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: result.data.user,
    type: result.data.type,
  });
}
