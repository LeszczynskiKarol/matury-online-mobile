// ============================================================================
// API Client — connects to matury-online.pl Fastify backend
// ============================================================================

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { getInstallId } from "../lib/installId";

// Wersja z app.json (bare: trzymana w zgodzie z build.gradle). Idzie w nagłówku
// X-App-Version, żeby panel widział, ile osób siedzi na starym buildzie.
const APP_VERSION: string = Constants.expoConfig?.version ?? "unknown";

// ── Konfiguracja ──────────────────────────────────────────────────────────
// PROD backend — ten sam co web app. Build release bierze ZAWSZE produkcję.
// W trybie deweloperskim można wskazać lokalny backend zmienną Metro
// `EXPO_PUBLIC_API_URL` (np. http://localhost:3002 + `adb reverse`) — bez
// ręcznego odkomentowywania, które groziło wysłaniem złego adresu do Sklepu
// (lustro zdaj-angielski-mobile/src/api/client.ts). Bez zmiennej: produkcja.
const PROD_URL = "https://www.matury-online.pl";
const API_BASE_URL = __DEV__
  ? process.env.EXPO_PUBLIC_API_URL || PROD_URL
  : PROD_URL;

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

// ── Limity czasu ──────────────────────────────────────────────────────────
// Dawne 15 s dla wszystkiego ucinało ocenę AI (luki, zadania otwarte, arkusz):
// backend i tak oceniał i pobierał kredyty, a uczeń widział błąd i klikał
// „Sprawdź” jeszcze raz (27.09.2026). Operacje z oceną/generowaniem AI mają
// długie limity, zwykłe zapytania 45 s. Jawne `timeout` w wywołaniu wygrywa.
function defaultTimeoutFor(path: string): number {
  if (/^\/exams\/[^/]+\/(submit|grade|estimate)/.test(path)) return 180000;
  if (/^\/admin\//.test(path)) return 180000;
  if (/^\/(answers\/submit|diagnosis\/v2\/(answer|finish)|placement\/submit|listening\/(start|next))/.test(path)) return 120000;
  if (/^\/vocab\/(session|answer)/.test(path)) return 90000;
  if (/^\/questions\/[^/]+\/reveal/.test(path)) return 30000;
  return 45000;
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
  } = options;
  const timeout = options.timeout ?? defaultTimeoutFor(path);

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
    // Analityka użycia po stronie serwera (panel admina → Użycie): platforma
    // i wersja apki idą z nagłówkami, apka nie ma żadnego SDK analitycznego.
    "X-Platform": Platform.OS,
    "X-App-Version": APP_VERSION,
    // Deklaracja: ta wersja dobiera klucz odpowiedzi PO odpowiedzi
    // (lib/answerKeys.ts), więc backend oddaje pytania bez klucza.
    "X-Answer-Reveal": "server",
  };

  // Losowy identyfikator instalacji — backend daje darmowy pakiet startowy
  // raz na urządzenie. Brak (błąd magazynu) = zapytanie idzie bez nagłówka.
  try {
    const installId = await getInstallId();
    if (installId) headers["X-Install-Id"] = installId;
  } catch {}

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
