# LogiVibe — WMS Integration API

Dedicated server-to-server endpoint for a single WMS partner to push delivery orders into LogiVibe (FlyBox Delivery).

- **Scope:** create orders only — no list, update, cancel or status read.
- **Order ownership:** every order is attached to an existing customer (`Contact`) by their **public ID** (e.g. `contact_hfUTCffBuO`). The customer is provisioned by FlyBox in the LogiVibe console; the ID is shared with the WMS team out of band. The customer then logs in to the LogiVibe customer portal and sees/tracks only their own orders.
- **Status updates:** there is no webhook. The customer follows their orders through the customer portal in real time.

---

## 1. Endpoints

| Environment | URL |
|-------------|-----|
| Production  | `https://api.flybox.rs/v1/integrations/wms/orders` |
| Dev / staging | `https://apifleetvibe.digitalvibe.rs/v1/integrations/wms/orders` |

Method: `POST` only.

## 2. Authentication

Send a static bearer token in the `Authorization` header. FlyBox will issue **separate** tokens for dev and prod. Treat them as secrets — never check them into source control, never log them.

```
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

> **Important — the token is case-sensitive.** It is a 64-character lowercase hex string (`0-9a-f` only). Copy/paste it exactly as we sent it. `E6858e...` and `e6858e...` are different tokens to our server, even though hex digits look interchangeable. Store it in an env var or secrets manager rather than typing it by hand.

Failure modes:

| Status | Meaning |
|--------|---------|
| `401`  | Token missing, malformed, or wrong. |
| `503`  | LogiVibe side is not configured (token / company not yet provisioned). Contact FlyBox. |

## 3. Request body

```json
{
  "customer": {
    "id": "contact_hfUTCffBuO"
  },
  "type": "transport",
  "scheduled_at": "2026-06-05T10:00:00+02:00",
  "internal_id": "WMS-12345",
  "notes": "Pozvati 15 min pre dolaska.",
  "payload": {
    "pickup": {
      "name": "Magacin A",
      "address": "Bulevar Kralja Aleksandra 1, Beograd",
      "street1": "Bulevar Kralja Aleksandra 1",
      "city": "Beograd",
      "province": "Beograd",
      "postal_code": "11000",
      "country": "RS",
      "location": { "type": "Point", "coordinates": [20.456, 44.819] }
    },
    "dropoff": {
      "name": "Marko Petrović",
      "phone": "+381601234567",
      "address": "Knez Mihailova 35, Beograd",
      "street1": "Knez Mihailova 35",
      "city": "Beograd",
      "postal_code": "11000",
      "country": "RS",
      "location": { "type": "Point", "coordinates": [20.461, 44.815] }
    }
  },
  "custom_field_values": [
    { "name": "cena-otkupa", "value": "1500" },
    { "name": "broj-primaoca", "value": "+381601234567" }
  ]
}
```

### Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `customer.id` | yes | Public ID of an **existing** `Contact` of type `customer` in LogiVibe — format `contact_XXXXXXXX` (visible in the LogiVibe console under Contacts). If it doesn't match, the request fails with `404`. The list of valid customer IDs is shared by FlyBox out of band. |
| `type` | no | OrderConfig `key` (e.g. `"transport"`). Defaults to `transport` if omitted. |
| `order_config_uuid` | no | Alternative to `type` — explicit UUID of the OrderConfig. Use only if FlyBox tells you to. |
| `scheduled_at` | no | ISO 8601 timestamp. Local time with offset is recommended (e.g. `2026-06-05T10:00:00+02:00`). |
| `internal_id` | no | Your own WMS order number. Stored as-is so FlyBox can cross-reference. |
| `notes` | no | Free-text instructions for the driver / dispatcher. |
| `meta` | no | Arbitrary key/value object. Stored for reference, not displayed in the driver app. |
| `payload.pickup` | yes | Pickup location. Inline `Place` object (see below) **or** a string `place_xxx` public_id of a Place already saved in LogiVibe. |
| `payload.dropoff` | yes | Drop-off location. Same shape as `pickup`. |
| `custom_field_values` | no | Array of `{ name, value }` objects (or `{ custom_field_uuid, value }` if you prefer UUIDs). |

### Place object

```jsonc
{
  "name": "Magacin A",              // short label shown in dispatch / driver app
  "address": "Full address line",   // single-line address (recommended)
  "street1": "Bulevar Kralja Aleksandra 1",
  "street2": null,
  "city": "Beograd",
  "province": "Beograd",
  "postal_code": "11000",
  "country": "RS",                  // ISO-3166 alpha-2
  "neighborhood": null,
  "building": null,
  "phone": "+381601234567",         // optional, attaches to drop-off contact
  "location": {                     // GeoJSON point — coordinates in [longitude, latitude] order
    "type": "Point",
    "coordinates": [20.456, 44.819]
  }
}
```

**Geocoding fallback:** if `location` is missing or coordinates are `[0, 0]`, LogiVibe will geocode `address` via Google Maps (locale `sr`, region `RS`). For best accuracy and zero ambiguity, send pre-geocoded coordinates from your WMS.

### Custom field values

FlyBox publishes the list of custom field `name` slugs that apply to each OrderConfig. Today the defaults for `transport` include:

| `name` slug      | Meaning |
|------------------|---------|
| `cena-otkupa`    | Cash-on-delivery amount in RSD (no decimals). |
| `broj-primaoca`  | Recipient phone number. |

Send a value by slug:

```json
"custom_field_values": [
  { "name": "cena-otkupa", "value": "1500" }
]
```

If a slug isn't recognised for the chosen `type`, that single value is silently skipped (logged on our side) — the rest of the order is still created. Ask FlyBox if you need a new field added.

## 4. Response

`201 Created`:

```json
{
  "id": "order_a1b2c3d4",
  "internal_id": "WMS-12345",
  "status": "created",
  "tracking_number": "TRK-9X8Y7Z",
  "scheduled_at": "2026-06-05T10:00:00+02:00",
  "customer": {
    "id": "contact_hfUTCffBuO",
    "name": "Firma DOO"
  }
}
```

Use `id` (or `internal_id`) when communicating with FlyBox about a specific order. `tracking_number` may be `null` for a brief moment after creation if it's still being assigned.

## 5. Error responses

| Status | Body                                                              | Meaning |
|--------|-------------------------------------------------------------------|---------|
| `401`  | `{ "error": "Invalid or missing WMS integration token." }`        | Bad token. |
| `404`  | `{ "error": "Customer not found." }`                               | `customer.id` doesn't match any existing FlyBox customer. |
| `422`  | `{ "error": "Validation failed.", "errors": { ...field: [msg] } }` | Schema validation (missing pickup, malformed `scheduled_at`, etc). |
| `422`  | `{ "error": "Order config (type) could not be resolved." }`       | Unknown `type` / `order_config_uuid`. |
| `503`  | `{ "error": "WMS integration is not configured on this server." }` | LogiVibe side not yet provisioned — contact FlyBox. |

## 6. cURL example

```bash
curl -X POST https://apifleetvibe.digitalvibe.rs/v1/integrations/wms/orders \
  -H "Authorization: Bearer $WMS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "customer": { "id": "contact_hfUTCffBuO" },
    "type": "transport",
    "scheduled_at": "2026-06-05T10:00:00+02:00",
    "internal_id": "WMS-12345",
    "notes": "Pozvati 15 min pre dolaska.",
    "payload": {
      "pickup": {
        "name": "Magacin A",
        "address": "Bulevar Kralja Aleksandra 1, Beograd",
        "city": "Beograd",
        "postal_code": "11000",
        "country": "RS",
        "location": { "type": "Point", "coordinates": [20.456, 44.819] }
      },
      "dropoff": {
        "name": "Marko Petrović",
        "phone": "+381601234567",
        "address": "Knez Mihailova 35, Beograd",
        "city": "Beograd",
        "postal_code": "11000",
        "country": "RS",
        "location": { "type": "Point", "coordinates": [20.461, 44.815] }
      }
    },
    "custom_field_values": [
      { "name": "cena-otkupa", "value": "1500" },
      { "name": "broj-primaoca", "value": "+381601234567" }
    ]
  }'
```

## 7. Operational notes

- **Idempotency:** the endpoint is not idempotent today. If you retry after a network error, you may create a duplicate. Use `internal_id` as your dedupe key and ask FlyBox before retrying if you're unsure.
- **Batch imports:** when pushing many orders in one batch and you don't want LogiVibe to send a confirmation email for each one, add the header `X-Skip-Order-Notification: 1`. Default behaviour is to send the customer a confirmation per order.
- **Rate limiting:** no hard limit currently. Keep it under ~10 requests/second to avoid getting throttled at the proxy layer. If you need higher sustained throughput, contact FlyBox.
- **Customer portal:** after a successful create, the customer can see the order at `https://flybox.rs/` (production) by logging in with their own credentials (separate from this API token).

## 8. Changelog

- 2026-06-01 — Initial release.
