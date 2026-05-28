import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { fleetbaseApi } from "@/lib/api-client";
import { getDefaultOrderConfigUuid } from "@/lib/order-config";
import { enrichOrdersResponse } from "@/lib/custom-fields";
import type { Order } from "@/lib/types";

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

  // Fleetbase single-order GET vraća order objekat na top level (ne pod ključem),
  // dok lista vraća { orders: [...] }. Pakujemo i jedno i drugo da bismo dopunili nested custom_field.
  const raw = result.data as Order | { order?: Order };
  const wrapped = (raw && typeof raw === "object" && "order" in raw && raw.order)
    ? (raw as { order: Order })
    : { order: raw as Order };

  const configUuid = await getDefaultOrderConfigUuid(token);
  await enrichOrdersResponse(token, configUuid, wrapped);

  // Vrati isti shape koji je backend vratio.
  if (raw && typeof raw === "object" && "order" in raw) {
    return NextResponse.json(raw);
  }
  return NextResponse.json(wrapped.order);
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
