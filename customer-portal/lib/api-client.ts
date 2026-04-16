const FLEETBASE_API_URL = process.env.FLEETBASE_API_URL || "http://localhost:8000";

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
  params?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export async function fleetbaseApi<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, token, params } = options;

  const url = new URL(`/int/v1/${path}`, FLEETBASE_API_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    data: data as T,
  };
}

export async function fleetbaseLogin(
  identity: string,
  password: string
): Promise<ApiResponse<{ token: string; type: string }>> {
  return fleetbaseApi("auth/login", {
    method: "POST",
    body: { identity, password },
  });
}

export async function fleetbaseLogout(token: string): Promise<ApiResponse> {
  return fleetbaseApi("auth/logout", {
    method: "POST",
    token,
  });
}

export async function fleetbaseSession(
  token: string
): Promise<
  ApiResponse<{ token: string; user: string; type: string; verified: boolean }>
> {
  return fleetbaseApi("auth/session", { token });
}
