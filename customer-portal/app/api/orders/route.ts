import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { fleetbaseApi, fleetbaseSession } from "@/lib/api-client";
import { resolveCustomerContact } from "@/lib/customer";
import { getDefaultOrderConfigUuid } from "@/lib/order-config";

/**
 * Ensures each place object has a `location` GeoJSON field.
 * Fleetbase requires `location` with type Point + coordinates.
 * If not provided, uses a default (Belgrade center).
 */
function ensurePlaceLocation(place: Record<string, unknown> | undefined) {
  if (!place) return place;
  if (!place.location) {
    place.location = {
      type: "Point",
      coordinates: [20.4489, 44.7866], // Belgrade default [lng, lat]
    };
  }
  return place;
}

export async function GET(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const params: Record<string, string> = {};

  // Forward supported query params
  if (searchParams.get("page")) params.page = searchParams.get("page")!;
  if (searchParams.get("limit")) params.limit = searchParams.get("limit")!;
  if (searchParams.get("sort")) params.sort = searchParams.get("sort")!;
  if (searchParams.get("after")) params.after = searchParams.get("after")!;
  if (searchParams.get("before")) params.before = searchParams.get("before")!;
  if (searchParams.get("query")) params.query = searchParams.get("query")!;

  const result = await fleetbaseApi("orders", { token, params });

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

  // Resolve customer Contact from the authenticated user
  const session = await fleetbaseSession(token);
  if (!session.ok) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const contact = await resolveCustomerContact(token, session.data.user);

  // Resolve default order config
  const orderConfigUuid = await getDefaultOrderConfigUuid(token);

  // Ensure places have location data
  if (body.payload) {
    if (body.payload.pickup) ensurePlaceLocation(body.payload.pickup);
    if (body.payload.dropoff) ensurePlaceLocation(body.payload.dropoff);
    if (Array.isArray(body.payload.waypoints)) {
      body.payload.waypoints.forEach(ensurePlaceLocation);
    }
  }

  // Build order data — inject customer and config server-side
  const orderData: Record<string, unknown> = {
    ...body,
    order_config_uuid: orderConfigUuid,
    customer_uuid: contact?.uuid,
    customer_type: contact
      ? "Fleetbase\\FleetOps\\Models\\Contact"
      : undefined,
    status: "created",
    dispatched: false,
  };

  // Strip any client-supplied customer field for security
  delete orderData.customer;

  const result = await fleetbaseApi("orders", {
    method: "POST",
    token,
    body: { order: orderData },
  });

  if (!result.ok) {
    return NextResponse.json(result.data, { status: result.status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
