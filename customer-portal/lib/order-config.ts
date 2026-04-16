import { fleetbaseApi } from "./api-client";

interface OrderConfig {
  uuid: string;
  name: string;
  key: string;
}

interface OrderConfigsResponse {
  order_configs?: OrderConfig[];
  "order-configs"?: OrderConfig[];
}

let cachedConfigUuid: string | null = null;

/**
 * Resolves the default order config UUID for the current company.
 * Caches the result in memory for the lifetime of the server process.
 */
export async function getDefaultOrderConfigUuid(
  token: string
): Promise<string | null> {
  if (cachedConfigUuid) return cachedConfigUuid;

  const result = await fleetbaseApi<OrderConfigsResponse>("order-configs", {
    token,
    params: { limit: "1" },
  });

  if (!result.ok) return null;

  const configs =
    result.data?.order_configs || result.data?.["order-configs"];
  if (Array.isArray(configs) && configs.length > 0) {
    cachedConfigUuid = configs[0].uuid;
    return cachedConfigUuid;
  }

  return null;
}
