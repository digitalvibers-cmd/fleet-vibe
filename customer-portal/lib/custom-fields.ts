import { fleetbaseApi } from "./api-client";
import type { CustomFieldValue, Order } from "./types";

// Fleetbase custom_fields.name is a dasherized slug auto-generated from the
// admin UI's Field Label (e.g. label "Cena otkupa" -> name "cena-otkupa").
// These constants must match exactly what an admin types as the Label in the
// Order Config Manager -> Custom Fields screen.
export const COD_AMOUNT_KEY = "cena-otkupa";
export const RECIPIENT_PHONE_KEY = "broj-primaoca";

export interface CustomFieldDef {
  uuid: string;
  name: string;
  label: string;
  type: string;
}

interface CustomFieldsResponse {
  custom_fields?: CustomFieldDef[];
  "custom-fields"?: CustomFieldDef[];
}

let cached: Record<string, CustomFieldDef> | null = null;

async function fetchOrderCustomFields(
  token: string,
  orderConfigUuid: string
): Promise<Record<string, CustomFieldDef>> {
  const result = await fleetbaseApi<CustomFieldsResponse>("custom-fields", {
    token,
    params: { subject_uuid: orderConfigUuid },
  });
  if (!result.ok) return {};
  const fields =
    result.data?.custom_fields || result.data?.["custom-fields"] || [];
  return Object.fromEntries(fields.map((f) => [f.name, f]));
}

export async function getOrderCustomFields(
  token: string,
  orderConfigUuid: string
): Promise<Record<string, CustomFieldDef>> {
  if (cached) return cached;
  cached = await fetchOrderCustomFields(token, orderConfigUuid);
  return cached;
}

export function invalidateCustomFieldsCache(): void {
  cached = null;
}

export interface CustomFieldKV {
  key: string;
  value: string;
}

export interface ResolvedCustomFieldValue {
  custom_field_uuid: string;
  value: string;
  // Required by HasCustomFields::syncCustomFieldValues — the underlying
  // custom_field_values table has value_type NOT NULL. The CustomValue cast
  // only JSON-encodes when this is 'object' or 'array'; for money/phone/text
  // inputs we want the raw string round-trip, so 'text' is correct.
  value_type: "text";
}

export async function resolveCustomFieldValues(
  token: string,
  orderConfigUuid: string,
  values: CustomFieldKV[]
): Promise<{ resolved: ResolvedCustomFieldValue[]; unknownKeys: string[] }> {
  if (!values.length) return { resolved: [], unknownKeys: [] };

  let defs = await getOrderCustomFields(token, orderConfigUuid);

  // If any requested key is missing from the cached defs, the admin may have
  // added a new custom field in the Fleetbase UI after the cache was populated.
  // Invalidate and re-fetch once before declaring keys unknown.
  const hasMissing = values.some(
    (v) => v.value && String(v.value).trim() && !defs[v.key]
  );
  if (hasMissing) {
    invalidateCustomFieldsCache();
    defs = await getOrderCustomFields(token, orderConfigUuid);
  }

  const resolved: ResolvedCustomFieldValue[] = [];
  const unknownKeys: string[] = [];

  for (const { key, value } of values) {
    if (!value || !String(value).trim()) continue;
    const def = defs[key];
    if (!def) {
      unknownKeys.push(key);
      continue;
    }
    resolved.push({
      custom_field_uuid: def.uuid,
      value: String(value),
      value_type: "text",
    });
  }

  return { resolved, unknownKeys };
}

/**
 * Vraća vrednost custom field-a po name slug-u (npr "cena-otkupa") iz
 * jednog Order objekta. Podržava dva oblika koje backend može serijalizovati:
 *   1) `cfv.custom_field.name` (nested)
 *   2) samo `cfv.custom_field_uuid` (uz pomoć defs mape za rezoluciju)
 *
 * UI komponentama trebaju samo nesirovi name slugovi — defs mapa je opcionalna.
 */
export function getCustomFieldValue(
  cfvs: CustomFieldValue[] | undefined,
  key: string,
  defs?: Record<string, CustomFieldDef>
): string | null {
  if (!cfvs?.length) return null;
  for (const cfv of cfvs) {
    if (cfv.custom_field?.name === key) {
      const v = cfv.value;
      return v != null && String(v).trim() !== "" ? String(v) : null;
    }
    if (defs && defs[key]?.uuid === cfv.custom_field_uuid) {
      const v = cfv.value;
      return v != null && String(v).trim() !== "" ? String(v) : null;
    }
  }
  return null;
}

/**
 * Server-side: ako odgovor backenda ne uključuje nested `custom_field`
 * objekat u svakoj CFV, ručno ga dopuni iz cached defs mape kako bi UI
 * mogao da radi `cfv.custom_field.name`.
 *
 * Tiho preskače CFV-e bez poklapanja (orphaned uuid).
 */
export function enrichCustomFieldValues(
  cfvs: CustomFieldValue[] | undefined,
  defs: Record<string, CustomFieldDef>
): CustomFieldValue[] {
  if (!cfvs?.length) return [];
  const byUuid: Record<string, CustomFieldDef> = {};
  for (const def of Object.values(defs)) byUuid[def.uuid] = def;
  return cfvs.map((cfv) => {
    if (cfv.custom_field?.name) return cfv;
    const def = byUuid[cfv.custom_field_uuid];
    if (!def) return cfv;
    return {
      ...cfv,
      custom_field: { uuid: def.uuid, name: def.name, label: def.label },
    };
  });
}

/**
 * Ulazni param: response objekat sa GET /int/v1/orders ili /int/v1/orders/{id}.
 * Mutira (i vraća) isti objekat, dopunjujući custom_field_values nested custom_field-om.
 * No-op ako defs nisu dostupne.
 */
export async function enrichOrdersResponse<T extends { orders?: Order[]; order?: Order } & Record<string, unknown>>(
  token: string,
  orderConfigUuid: string | null,
  payload: T
): Promise<T> {
  if (!orderConfigUuid) return payload;
  const defs = await getOrderCustomFields(token, orderConfigUuid);
  if (!Object.keys(defs).length) return payload;

  const enrichOne = (order: Order | undefined): void => {
    if (!order?.custom_field_values?.length) return;
    order.custom_field_values = enrichCustomFieldValues(order.custom_field_values, defs);
  };

  if (Array.isArray(payload.orders)) {
    for (const o of payload.orders) enrichOne(o);
  }
  if (payload.order) enrichOne(payload.order);
  return payload;
}
