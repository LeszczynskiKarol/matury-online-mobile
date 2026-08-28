// ============================================================================
// Google Play Billing — jedno miejsce, przez które przechodzą wszystkie zakupy
// src/context/BillingContext.tsx
//
// Dlaczego kontekst, a nie hook na ekranie subskrypcji: zakup w Play NIE jest
// atomowy z punktu widzenia apki. Użytkownik potwierdza płatność w oknie
// sklepu, apka w tym czasie może zostać ubita przez system, a zakup i tak
// dochodzi do skutku. Play trzyma go wtedy w kolejce do momentu, aż zawołamy
// finishTransaction() — czyli dopóki NIE potwierdzimy go na naszym serwerze,
// zakup czeka. Nasłuch i „dojazd" zaległych zakupów muszą więc żyć na poziomie
// całej aplikacji i odpalać się przy każdym starcie, a nie tylko wtedy, gdy
// akurat jest otwarty ekran subskrypcji.
//
// Kolejność jest zawsze ta sama i nie wolno jej odwracać:
//   1. Play zwraca purchaseToken
//   2. nasz backend weryfikuje go w Play Developer API i nadaje dostęp
//   3. dopiero wtedy finishTransaction() zdejmuje zakup z kolejki
// Odwrócona (finish przed weryfikacją) gubi zakupy przy każdym błędzie sieci:
// Play uzna sprawę za zamkniętą, a user nie dostanie tego, za co zapłacił.
// ============================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { useIAP } from "expo-iap";
import type { Product, ProductSubscription, Purchase } from "expo-iap";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import {
  ALL_SKUS,
  CONSUMABLE_SKUS,
  INAPP_SKUS,
  SUBSCRIPTION_SKUS,
} from "../billing/products";

interface VerifyResponse {
  granted: boolean;
  reason: string;
  isPremium: boolean;
  subscriptionStatus: string;
  subscriptionEnd: string | null;
  credits: number;
}

/**
 * Błędy z warstwy natywnej przychodzą po angielsku („Failed to query product")
 * i trafiały prosto na ekran. Mapujemy je na komunikaty, z którymi uczeń może
 * cokolwiek zrobić.
 */
function polishError(e: any): string {
  const code = e?.code || "";
  const msg = String(e?.message || "");
  if (code === "query-product" || /query product/i.test(msg))
    return "Nie udało się pobrać oferty ze Sklepu Play. Spróbuj ponownie za chwilę.";
  if (/service connection|disconnected|BILLING_UNAVAILABLE/i.test(msg))
    return "Brak połączenia ze Sklepem Play. Sprawdź, czy jest zainstalowany, zaktualizowany i zalogowany.";
  if (/ITEM_UNAVAILABLE|not available/i.test(msg))
    return "Ten produkt nie jest dostępny na Twoim koncie Google.";
  if (/network|timeout/i.test(msg)) return "Brak połączenia z internetem.";
  return "Coś poszło nie tak po stronie Sklepu Play. Spróbuj ponownie.";
}

interface BillingContextValue {
  /** Połączenie ze sklepem. false = brak Google Play na urządzeniu. */
  connected: boolean;
  /** true dopóki trwa pierwsze pobranie katalogu. */
  loading: boolean;
  subscriptions: ProductSubscription[];
  products: Product[];
  /** SKU, którego zakup jest właśnie w toku (blokuje przyciski). */
  pending: string | null;
  /** Ostatni błąd do pokazania użytkownikowi. */
  error: string | null;
  buy: (sku: string) => Promise<void>;
  /** Ponowna próba połączenia + odświeżenie katalogu. */
  reload: () => Promise<void>;
  priceOf: (sku: string) => string | null;
  /**
   * Czy da się kupić TEN produkt. Samo `connected` nie wystarcza: Play potrafi
   * zgłosić połączenie, a chwilę później nie zwrócić żadnego produktu (stary
   * Sklep Play, produkt niedostępny w kraju użytkownika, apka spoza toru
   * testowego). Bez tej kontroli przycisk „Subskrybuj" jest aktywny, pokazuje
   * cenę „—" i po kliknięciu nie dzieje się nic.
   */
  hasProduct: (sku: string) => boolean;
  /** Katalog pusty mimo zakończonego pobierania — sklep jest nie do użycia. */
  storeUnavailable: boolean;
}

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { refresh, isLoggedIn } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Tokeny obsłużone w tej sesji — getAvailablePurchases() potrafi zwrócić ten
  // sam zakup kilka razy (przy każdym wejściu w ekran), a każdy przelot przez
  // /verify to zbędny request.
  const handled = useRef<Set<string>>(new Set());

  const isConsumable = (sku: string) => CONSUMABLE_SKUS.includes(sku);

  const {
    connected,
    products,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getAvailablePurchases,
    availablePurchases,
    reconnect,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void settle(purchase);
    },
    onPurchaseError: (e: any) => {
      setPending(null);
      // Anulowanie przez użytkownika nie jest błędem — nie straszymy alertem.
      const code = e?.code || "";
      if (code === "E_USER_CANCELLED" || code === "user-cancelled") return;
      setError(polishError(e));
    },
    onError: (e) => {
      setError(polishError(e));
    },
  });

  /**
   * Zamknięcie zakupu: weryfikacja na naszym serwerze → finishTransaction.
   * Bez `purchaseToken` nie ma czego weryfikować (iOS ma tu JWS, ale apka
   * jest wydawana tylko na Androida).
   */
  const settle = useCallback(
    async (purchase: Purchase) => {
      const purchaseToken = (purchase as any)?.purchaseToken as
        | string
        | undefined;
      const productId = purchase?.productId;
      if (!purchaseToken || !productId) {
        setPending(null);
        return;
      }
      if (handled.current.has(purchaseToken)) {
        setPending(null);
        return;
      }

      try {
        const res = await api<VerifyResponse>("/play/verify", {
          method: "POST",
          body: { productId, purchaseToken },
        });

        if (res.granted || res.reason === "Zakup już zaliczony") {
          handled.current.add(purchaseToken);
          // Dopiero teraz zakup może zniknąć z kolejki Play.
          await finishTransaction({
            purchase,
            isConsumable: isConsumable(productId),
          }).catch(() => {});
          await refresh?.();
          setError(null);
        } else {
          // Serwer świadomie odmówił (np. subskrypcja w stanie ON_HOLD).
          // Zakupu NIE domykamy — Play przypomni o nim przy kolejnym starcie.
          setError(res.reason || "Zakup nie został potwierdzony.");
        }
      } catch (e: any) {
        // Błąd sieci/serwera: zostawiamy zakup w kolejce Play. Przy następnym
        // uruchomieniu apki wróci przez getAvailablePurchases() i spróbujemy
        // jeszcze raz — user nie musi nic robić.
        setError(
          e?.status === 502
            ? "Potwierdzenie zakupu chwilowo niedostępne — dokończymy je automatycznie."
            : e?.message || "Nie udało się potwierdzić zakupu.",
        );
      } finally {
        setPending(null);
      }
    },
    [finishTransaction, refresh],
  );

  // ── Katalog ───────────────────────────────────────────────────────────────
  const loadCatalog = useCallback(async () => {
    if (!connected) return;
    try {
      await fetchProducts({ skus: SUBSCRIPTION_SKUS, type: "subs" });
      await fetchProducts({ skus: INAPP_SKUS, type: "in-app" });
    } catch (e: any) {
      setError(polishError(e));
    } finally {
      setLoading(false);
    }
  }, [connected, fetchProducts]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      setLoading(false);
      return;
    }
    if (connected) void loadCatalog();
  }, [connected, loadCatalog]);

  // Dojazd zakupów, które nie zdążyły przejść weryfikacji (apka ubita w
  // trakcie, brak sieci, restart telefonu). Odpalamy po zalogowaniu — bez
  // sesji /verify i tak odbiłoby się o 401.
  useEffect(() => {
    if (!connected || !isLoggedIn) return;
    void getAvailablePurchases().catch(() => {});
  }, [connected, isLoggedIn, getAvailablePurchases]);

  useEffect(() => {
    if (!availablePurchases?.length || !isLoggedIn) return;
    for (const p of availablePurchases) {
      const t = (p as any)?.purchaseToken;
      if (t && !handled.current.has(t)) void settle(p);
    }
  }, [availablePurchases, isLoggedIn, settle]);

  // ── Zakup ─────────────────────────────────────────────────────────────────
  const hasProduct = useCallback(
    (sku: string) =>
      subscriptions.some((p) => p.id === sku) ||
      products.some((p) => p.id === sku),
    [subscriptions, products],
  );

  const buy = useCallback(
    async (sku: string) => {
      setError(null);
      if (!connected) {
        setError(
          "Brak połączenia ze Sklepem Play. Sprawdź, czy jest zainstalowany, zaktualizowany i zalogowany na Twoje konto.",
        );
        return;
      }
      // Play zgłasza połączenie także wtedy, gdy nie potrafi wydać ani jednego
      // produktu. Otwieranie wtedy okna zakupu kończy się ciszą — lepiej
      // powiedzieć wprost, że oferty nie ma.
      if (!hasProduct(sku)) {
        setError(
          "Oferta nie jest w tej chwili dostępna w Sklepie Play. Spróbuj ponownie za chwilę.",
        );
        return;
      }
      setPending(sku);
      try {
        const isSub = SUBSCRIPTION_SKUS.includes(sku);
        if (isSub) {
          // Play wymaga wskazania oferty (base plan / promocja) — bierzemy
          // pierwszą dostępną dla tego SKU. Bez offerToken okno zakupu
          // subskrypcji w ogóle się nie otworzy.
          const product = subscriptions.find((s) => s.id === sku);
          const offers = (product as any)?.subscriptionOffers || [];
          const offerToken = offers[0]?.offerToken;

          await requestPurchase({
            type: "subs",
            request: {
              google: {
                skus: [sku],
                ...(offerToken
                  ? { subscriptionOffers: [{ sku, offerToken }] }
                  : {}),
              },
            },
          });
        } else {
          await requestPurchase({
            type: "in-app",
            request: { google: { skus: [sku] } },
          });
        }
      } catch (e: any) {
        setPending(null);
        const code = e?.code || "";
        if (code === "E_USER_CANCELLED" || code === "user-cancelled") return;
        setError(polishError(e));
      }
    },
    [connected, requestPurchase, subscriptions, hasProduct],
  );

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (!connected) await reconnect();
      await loadCatalog();
    } finally {
      setLoading(false);
    }
  }, [connected, reconnect, loadCatalog]);

  const priceOf = useCallback(
    (sku: string) => {
      const found =
        subscriptions.find((s) => s.id === sku) ||
        products.find((p) => p.id === sku);
      return (found as any)?.displayPrice ?? null;
    },
    [subscriptions, products],
  );

  // Sklep jest nie do użycia, gdy nie ma połączenia ALBO gdy pobieranie się
  // skończyło, a katalog został pusty.
  const storeUnavailable =
    !loading && (!connected || subscriptions.length + products.length === 0);

  const value = useMemo<BillingContextValue>(
    () => ({
      connected,
      loading,
      subscriptions,
      products,
      pending,
      error,
      buy,
      reload,
      priceOf,
      hasProduct,
      storeUnavailable,
    }),
    [
      connected,
      loading,
      subscriptions,
      products,
      pending,
      error,
      buy,
      reload,
      priceOf,
      hasProduct,
      storeUnavailable,
    ],
  );

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}

export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx)
    throw new Error("useBilling musi być wywołane wewnątrz BillingProvider");
  return ctx;
}

export { ALL_SKUS };
