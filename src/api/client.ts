// ============================================================================
// API Client — connects to matury-online.pl Fastify backend
// ============================================================================

import * as SecureStore from "expo-secure-store";

// ── Konfiguracja ──────────────────────────────────────────────────────────
// PROD backend — ten sam co web app
const API_BASE_URL = "https://www.matury-online.pl";

const TOKEN_KEY = "matury_auth_token";

// ── Token management ──────────────────────────────────────────────────────
let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    return cachedToken;
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── API Error ─────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
    public data?: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Generic request ───────────────────────────────────────────────────────
interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  params?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
  timeout?: number;
}

export async function api<T = any>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    params,
    auth = true,
    timeout = 15000,
  } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}/api${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  // Headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Client": "matury-mobile", // ← backend może użyć do pominięcia reCAPTCHA
  };

  if (auth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Fetch with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    let data: any;
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data?.code,
        data?.error || data?.message || `HTTP ${response.status}`,
        data,
      );
    }

    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new ApiError(0, "TIMEOUT", "Przekroczono czas połączenia");
    }
    throw new ApiError(0, "NETWORK", "Brak połączenia z serwerem");
  }
}

export { API_BASE_URL };
