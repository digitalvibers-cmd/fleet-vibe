import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { fleetbaseApi, fleetbaseSession } from "@/lib/api-client";
import { resolveCustomerContact } from "@/lib/customer";
import { getDefaultOrderConfigUuid } from "@/lib/order-config";
import type { ParsedOrder } from "@/lib/excel-import";
import type { Order } from "@/lib/types";

const BELGRADE_LOCATION = { type: "Point", coordinates: [20.4489, 44.7866] };

function buildPlace(name: string, address: string, city: string, postal: string) {
    return {
        name: name || address,
        street1: address,
        city,
        postal_code: postal,
        country: "RS",
        location: BELGRADE_LOCATION,
    };
}

interface ImportResult {
    succeeded: Order[];
    failed: { rowIndex: number; error: string }[];
}

export async function POST(request: NextRequest) {
    const token = await getAuthToken();
    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await fleetbaseSession(token);
    if (!session.ok) {
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const body = await request.json() as { orders: ParsedOrder[] };
    const orders = body.orders?.filter((o) => o.isValid) ?? [];

    if (orders.length === 0) {
        return NextResponse.json({ error: "Nema validnih porudžbina" }, { status: 400 });
    }

    const [contact, orderConfigUuid] = await Promise.all([
        resolveCustomerContact(token, session.data.user),
        getDefaultOrderConfigUuid(token),
    ]);

    const result: ImportResult = { succeeded: [], failed: [] };

    for (const order of orders) {
        const orderData = {
            payload: {
                pickup: buildPlace(order.pickupName, order.pickupAddress, order.pickupCity, order.pickupPostal),
                dropoff: buildPlace(order.dropoffName, order.dropoffAddress, order.dropoffCity, order.dropoffPostal),
            },
            notes: order.notes || undefined,
            scheduled_at: order.scheduledAt || undefined,
            order_config_uuid: orderConfigUuid,
            customer_uuid: contact?.uuid,
            customer_type: contact ? "Fleetbase\\FleetOps\\Models\\Contact" : undefined,
            status: "created",
            dispatched: false,
        };

        const res = await fleetbaseApi<{ order: Order }>("orders", {
            method: "POST",
            token,
            body: { order: orderData },
        });

        if (res.ok) {
            result.succeeded.push(res.data.order);
        } else {
            const errMsg = (res.data as Record<string, unknown>)?.message as string | undefined;
            result.failed.push({ rowIndex: order.rowIndex, error: errMsg ?? `HTTP ${res.status}` });
        }
    }

    return NextResponse.json(result, { status: 200 });
}
