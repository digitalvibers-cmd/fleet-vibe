import { NextRequest, NextResponse } from "next/server";
import { requireValidSession } from "@/lib/auth";
import { fleetbaseApi } from "@/lib/api-client";
import { resolveCustomerContact } from "@/lib/customer";
import { getDefaultOrderConfigUuid } from "@/lib/order-config";
import { resolveCustomFieldValues } from "@/lib/custom-fields";
import { latinToCyrillic, hasLatinChars } from "@/lib/serbian-translit";
import type { ParsedOrder } from "@/lib/excel-import";
import type { Order } from "@/lib/types";

interface GeocodedPlace {
    name?: string;
    street1?: string;
    city?: string;
    province?: string;
    country?: string;
    postal_code?: string;
    neighborhood?: string;
    building?: string;
    location?: { type: "Point"; coordinates: [number, number] };
}

function pickPlaceFields(raw: GeocodedPlace, fallbackName: string, fallbackStreet: string, fallbackCity: string, fallbackPostal: string): GeocodedPlace | null {
    if (!raw?.location?.coordinates || raw.location.coordinates.length !== 2) {
        return null;
    }
    const [lng, lat] = raw.location.coordinates;
    // Reject (0,0) — backend Geocoder still returns a Place with (0,0) when no result.
    if (lng === 0 && lat === 0) return null;

    return {
        name: fallbackName || raw.name || raw.street1 || fallbackStreet,
        street1: raw.street1 || fallbackStreet,
        city: raw.city || fallbackCity,
        province: raw.province,
        country: raw.country || "RS",
        postal_code: raw.postal_code || fallbackPostal,
        neighborhood: raw.neighborhood,
        building: raw.building,
        location: raw.location,
    };
}

async function geocodeAddress(
    token: string,
    name: string,
    street: string,
    city: string,
    postal: string
): Promise<GeocodedPlace | null> {
    const buildQuery = (streetVariant: string, cityVariant: string) =>
        [streetVariant, cityVariant, postal, "Srbija"].filter(Boolean).join(", ");

    const tryQuery = async (query: string) => {
        const res = await fleetbaseApi<GeocodedPlace | GeocodedPlace[]>("geocoder/query", {
            token,
            params: { query, single: "1" },
        });
        if (!res.ok) return null;
        const data = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!data) return null;
        return pickPlaceFields(data, name, street, city, postal);
    };

    // Primary attempt with the address as typed in the spreadsheet.
    let result = await tryQuery(buildQuery(street, city));
    if (result) return result;

    // Cyrillic fallback for Serbian addresses typed in latin.
    if (hasLatinChars(street) || hasLatinChars(city)) {
        result = await tryQuery(buildQuery(latinToCyrillic(street), latinToCyrillic(city)));
        if (result) return result;
    }

    return null;
}

interface ImportResult {
    succeeded: Order[];
    failed: { rowIndex: number; error: string }[];
}

export async function POST(request: NextRequest) {
    const session = await requireValidSession();
    if (!session) {
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    const { token } = session;

    const body = await request.json() as { orders: ParsedOrder[] };
    const orders = body.orders?.filter((o) => o.isValid) ?? [];

    if (orders.length === 0) {
        return NextResponse.json({ error: "Nema validnih porudžbina" }, { status: 400 });
    }

    const [contact, orderConfigUuid] = await Promise.all([
        resolveCustomerContact(token, session.user),
        getDefaultOrderConfigUuid(token),
    ]);

    const result: ImportResult = { succeeded: [], failed: [] };

    for (const order of orders) {
        const pickup = await geocodeAddress(
            token,
            order.pickupName,
            order.pickupAddress,
            order.pickupCity,
            order.pickupPostal
        );
        if (!pickup) {
            result.failed.push({
                rowIndex: order.rowIndex,
                error: `Adresa preuzimanja nije pronađena: ${order.pickupAddress}, ${order.pickupCity}`,
            });
            continue;
        }

        const dropoff = await geocodeAddress(
            token,
            order.dropoffName,
            order.dropoffAddress,
            order.dropoffCity,
            order.dropoffPostal
        );
        if (!dropoff) {
            result.failed.push({
                rowIndex: order.rowIndex,
                error: `Adresa dostave nije pronađena: ${order.dropoffAddress}, ${order.dropoffCity}`,
            });
            continue;
        }

        let customFieldValues:
            | { custom_field_uuid: string; value: string; value_type: "text" }[]
            | undefined;
        if (orderConfigUuid && (order.codAmount || order.recipientPhone)) {
            const kv: { key: string; value: string }[] = [];
            if (order.codAmount) kv.push({ key: "cena-otkupa", value: order.codAmount });
            if (order.recipientPhone)
                kv.push({ key: "broj-primaoca", value: order.recipientPhone });
            const { resolved, unknownKeys } = await resolveCustomFieldValues(
                token,
                orderConfigUuid,
                kv,
            );
            if (unknownKeys.length) {
                result.failed.push({
                    rowIndex: order.rowIndex,
                    error: `Polja "Otkup" nisu konfigurisana u Order Config-u (${unknownKeys.join(", ")}). Kontaktirajte administratora.`,
                });
                continue;
            }
            if (resolved.length) customFieldValues = resolved;
        }

        const orderData = {
            payload: { pickup, dropoff },
            notes: order.notes || undefined,
            scheduled_at: order.scheduledAt || undefined,
            order_config_uuid: orderConfigUuid,
            customer_uuid: contact?.uuid,
            customer_type: contact ? "Fleetbase\\FleetOps\\Models\\Contact" : undefined,
            status: "created",
            dispatched: false,
            custom_field_values: customFieldValues,
        };

        const res = await fleetbaseApi<{ order: Order }>("orders", {
            method: "POST",
            token,
            body: { order: orderData },
            headers: { "X-Skip-Order-Notification": "1" },
        });

        if (res.ok) {
            result.succeeded.push(res.data.order);
        } else {
            const errMsg = (res.data as Record<string, unknown>)?.message as string | undefined;
            result.failed.push({ rowIndex: order.rowIndex, error: errMsg ?? `HTTP ${res.status}` });
        }
    }

    if (result.succeeded.length > 0) {
        const orderIds = result.succeeded.map((o) => o.public_id).filter(Boolean);
        await fleetbaseApi("orders/notify-bulk-created", {
            method: "POST",
            token,
            body: { order_ids: orderIds, count: orderIds.length },
        });
    }

    return NextResponse.json(result, { status: 200 });
}
