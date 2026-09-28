// ============================================================================
// Identyfikator instalacji — nagłówek X-Install-Id
// src/lib/installId.ts
//
// Losowy UUID v4 tworzony przy pierwszym uruchomieniu i trzymany w SecureStore
// (klucz `install_id`). Nie jest powiązany ze sprzętem ani kontem — znika po
// odinstalowaniu apki. Backend używa go, żeby darmowy pakiet startowy (arkusz
// + kredyty AI + ocena AI w diagnozie) trafiał raz na urządzenie, a nie raz na
// każde nowe konto zakładane z tego samego telefonu.
//
// Zasada: identyfikator nigdy nie blokuje zapytania. Gdy magazyn zawiedzie,
// nagłówek po prostu nie idzie.
// ============================================================================

import * as SecureStore from "expo-secure-store";

const INSTALL_ID_KEY = "install_id";
const VALID = /^[0-9a-f-]{16,64}$/;

let cached: string | null = null;
let pending: Promise<string | null> | null = null;

function randomBytes(n: number): Uint8Array | null {
  const bytes = new Uint8Array(n);
  try {
    // Moduł natywny ładowany leniwie — brak go w buildzie nie może wywalić
    // startu apki (import na górze pliku rzuciłby już przy ładowaniu).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Crypto = require("expo-crypto");
    if (typeof Crypto?.getRandomValues === "function") {
      Crypto.getRandomValues(bytes);
      return bytes;
    }
  } catch {}
  try {
    const g: any = globalThis as any;
    if (typeof g.crypto?.getRandomValues === "function") {
      g.crypto.getRandomValues(bytes);
      return bytes;
    }
  } catch {}
  return null;
}

function newUuid(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Crypto = require("expo-crypto");
    if (typeof Crypto?.randomUUID === "function") {
      const id = String(Crypto.randomUUID()).toLowerCase();
      if (VALID.test(id)) return id;
    }
  } catch {}
  const b = randomBytes(16);
  if (!b) return null; // bez bezpiecznego źródła losowości — lepiej nic niż Math.random
  b[6] = (b[6] & 0x0f) | 0x40; // wersja 4
  b[8] = (b[8] & 0x3f) | 0x80; // wariant RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function load(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(INSTALL_ID_KEY);
    if (stored && VALID.test(stored)) return stored;
  } catch {}
  const id = newUuid();
  if (!id) return null;
  try {
    await SecureStore.setItemAsync(INSTALL_ID_KEY, id);
  } catch {
    // Zapis się nie udał — używamy id w tej sesji; przy następnym starcie
    // powstanie nowe (gorzej niż stałe, ale lepiej niż brak nagłówka).
  }
  return id;
}

/** Identyfikator instalacji albo null, gdy nie da się go ustalić. Nie rzuca. */
export async function getInstallId(): Promise<string | null> {
  if (cached) return cached;
  if (!pending) {
    pending = load()
      .then((id) => {
        cached = id;
        return id;
      })
      .catch(() => null)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
