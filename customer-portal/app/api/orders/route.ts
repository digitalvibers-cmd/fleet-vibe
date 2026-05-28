import { NextRequest, NextResponse } from "next/server";
import { requireValidSession } from "@/lib/auth";
import { fleetbaseApi } from "@/lib/api-client";
import { resolveCustomerContact } from "@/lib/customer";
import { getDefaultOrderConfigUuid } from "@/lib/order-config";
import { resolveCustomFieldValues } from "@/lib/custom-fields";

// A place is valid if it is either a reference to an existing Place (uuid/public_id),
// or has real coordinates from a geocoder result. Without this guard, the backend
// happily creates Places at (0,0) and orders end up invisible on the operator map.
function isValidPlaceReference(place: Record<string, unknown> | undefined): boolean {
  if (!place) return false;
  if (typeof place.uuid === "string" && place.uuid) return true;
  if (typeof place.public_id === "string" && place.public_id) return true;
  const location = place.location as { coordinates?: unknown } | undefined;
  if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const session = await requireValidSession();
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  const { token } = session;

  const { searchParams } = request.nextUrl;
  const params: Record<string, string> = {};

  // Forward supported query params
  if (searchParams.get("page")) params.page = searchParams.get("page")!;
  if (searchParams.get("limit")) params.limit = searchParams.get("limit")!;
  if (searchParams.get("sort")) params.sort = searchParams.get("sort")!;
  if (searchParams.get("created_at")) params.created_at = searchParams.get("created_at")!;
  if (searchParams.get("status")) params.status = searchParams.get("status")!;
  if (searchParams.get("query")) params.query = searchParams.get("query")!;

  const result = await fleetbaseApi("orders", { token, params });

  if (!result.ok) {
    return NextResponse.json(result.data, { status: result.status });
  }

  return NextResponse.json(result.data);
}

export async function POST(request: NextRequest) {
  const session = await requireValidSession();
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  const { token } = session;

  const body = await request.json();

  const contact = await resolveCustomerContact(token, session.user);

  // Resolve default order config
  const orderConfigUuid = await getDefaultOrderConfigUuid(token);

  // Validate that every place has either a backend reference or real coordinates.
  if (body.payload) {
    if (body.payload.pickup && !isValidPlaceReference(body.payload.pickup)) {
      return NextResponse.json(
        { error: "Adresa preuzimanja nije validirana — odaberite adresu iz predloga." },
        { status: 400 }
      );
    }
    if (body.payload.dropoff && !isValidPlaceReference(body.payload.dropoff)) {
      return NextResponse.json(
        { error: "Adresa dostave nije validirana — odaberite adresu iz predloga." },
        { status: 400 }
      );
    }
    if (Array.isArray(body.payload.waypoints)) {
      for (const wp of body.payload.waypoints) {
        if (!isValidPlaceReference(wp)) {
          return NextResponse.json(
            { error: "Jedna od međustanica nije validirana — odaberite adresu iz predloga." },
            { status: 400 }
          );
        }
      }
    }
  }

  // Resolve custom_field_values (key -> custom_field_uuid) if present
  let resolvedCustomFieldValues:
    | { custom_field_uuid: string; value: string; value_type: "text" }[]
    | undefined;
  if (Array.isArray(body.custom_field_values) && body.custom_field_values.length && orderConfigUuid) {
    const { resolved, unknownKeys } = await resolveCustomFieldValues(
      token,
      orderConfigUuid,
      body.custom_field_values,
    );
    if (unknownKeys.length) {
      return NextResponse.json(
        {
          error: `Sledeća polja nisu konfigurisana u Order Config-u: ${unknownKeys.join(", ")}. Kontaktirajte administratora.`,
        },
        { status: 400 },
      );
    }
    if (resolved.length) resolvedCustomFieldValues = resolved;
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
    custom_field_values: resolvedCustomFieldValues,
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
