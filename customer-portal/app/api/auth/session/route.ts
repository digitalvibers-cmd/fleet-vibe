import { NextResponse } from "next/server";
import { requireValidSession } from "@/lib/auth";

export async function GET() {
  const session = await requireValidSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    type: session.type,
  });
}
