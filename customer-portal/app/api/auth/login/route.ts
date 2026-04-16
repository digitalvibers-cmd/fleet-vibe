import { NextRequest, NextResponse } from "next/server";
import { fleetbaseLogin } from "@/lib/api-client";
import { setAuthToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { identity, password } = await request.json();

  if (!identity || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const result = await fleetbaseLogin(identity, password);

  if (!result.ok) {
    const message =
      (result.data as { error?: string })?.error ||
      "Invalid credentials.";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  await setAuthToken(result.data.token);

  return NextResponse.json({
    type: result.data.type,
  });
}
