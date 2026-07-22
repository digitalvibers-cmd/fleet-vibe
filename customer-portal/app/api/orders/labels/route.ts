import { NextRequest, NextResponse } from "next/server";
import { requireValidSession } from "@/lib/auth";

const FLEETBASE_API_URL = process.env.FLEETBASE_API_URL || "http://localhost:8000";

// Streams the combined shipping-label PDF for the selected orders.
// The backend `customer-bulk-label` endpoint scopes strictly to the authenticated
// customer's own orders, so tampered ids can never leak another customer's labels.
// We hit it with a raw fetch (not fleetbaseApi, which JSON-parses and would corrupt
// the binary PDF), mirroring the Excel template route's binary-stream pattern.
export async function POST(request: NextRequest) {
  const session = await requireValidSession();
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  const { token } = session;

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids : [];

  if (!ids.length) {
    return NextResponse.json(
      { error: "Nijedna narudžbina nije odabrana." },
      { status: 400 }
    );
  }

  const url = new URL("/int/v1/orders/customer-bulk-label", FLEETBASE_API_URL);
  const upstream = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/pdf",
    },
    body: JSON.stringify({ ids, format: "stream" }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    let error = "Greška pri generisanju otpremnica.";
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      error = parsed.error || parsed.message || error;
    } catch {
      // non-JSON error body — keep default message
    }
    return NextResponse.json({ error }, { status: upstream.status });
  }

  const buffer = await upstream.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="otpremnice.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
