import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { fleetbaseApi } from "@/lib/api-client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await fleetbaseApi(`orders/${id}`, { token });

  if (!result.ok) {
    return NextResponse.json(result.data, { status: result.status });
  }

  return NextResponse.json(result.data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await fleetbaseApi("orders/cancel", {
    method: "PATCH",
    token,
    body: { order: id },
  });

  if (!result.ok) {
    return NextResponse.json(result.data, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
