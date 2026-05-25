import { fleetbaseApi } from "./api-client";

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
