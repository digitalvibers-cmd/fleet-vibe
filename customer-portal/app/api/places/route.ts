import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { fleetbaseApi } from "@/lib/api-client";

export async function GET(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const params: Record<string, string> = {};

  if (searchParams.get("query")) params.query = searchParams.get("query")!;
  if (searchParams.get("limit")) params.limit = searchParams.get("limit")!;

  const result = await fleetbaseApi("places", { token, params });

  if (!result.ok) {
    return NextResponse.json(result.data, { status: result.status });
  }

  return NextResponse.json(result.data);
}

export async function POST(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const result = await fleetbaseApi("places", {
    method: "POST",
    token,
    body: { place: body },
  });

  if (!result.ok) {
    return NextResponse.json(result.data, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
