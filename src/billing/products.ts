// ============================================================================
// Katalog produktów Google Play
// src/billing/products.ts
//
// SKU muszą być IDENTYCZNE z identyfikatorami w Play Console ORAZ z mapą
// PLAY_PRODUCTS w backend/src/services/play-billing.ts. Backend odrzuca zakup
// produktu, którego nie zna, więc rozjechanie tych dwóch list = zapłacone
// zakupy bez dostępu.
//
// Cen NIE trzymamy w kodzie. Cena pochodzi ze sklepu (`displayPrice`), bo to
// Play przelicza ją na walutę i podatek kraju użytkownika — zaszyta na sztywno
// „49 zł" byłaby nieprawdziwa dla każdego, kto ma konto Play spoza Polski.
// ============================================================================

export const SKU_PREMIUM_MONTHLY = "premium_monthly";
export const SKU_PREMIUM_30DAYS = "premium_30days";
export const SKU_CREDITS_200 = "credits_200";
export const SKU_CREDITS_500 = "credits_500";
export const SKU_CREDITS_1200 = "credits_1200";

/** Subskrypcje auto-odnawialne. */
export const SUBSCRIPTION_SKUS = [SKU_PREMIUM_MONTHLY];

/** Produkty jednorazowe. */
export const INAPP_SKUS = [
  SKU_PREMIUM_30DAYS,
  SKU_CREDITS_200,
  SKU_CREDITS_500,
  SKU_CREDITS_1200,
];

export const ALL_SKUS = [...SUBSCRIPTION_SKUS, ...INAPP_SKUS];

/**
 * Produkty konsumowalne — po nadaniu dostępu muszą zostać „skonsumowane",
 * inaczej Play uzna je za już posiadane i nie pozwoli kupić po raz drugi.
 * Dotyczy to WSZYSTKICH naszych produktów jednorazowych: i doładowań kredytów,
 * i 30-dniowego dostępu, który z założenia można przedłużać kolejnym zakupem.
 */
export const CONSUMABLE_SKUS = [...INAPP_SKUS];

export const CREDIT_PACKAGES: Array<{ sku: string; amount: number }> = [
  { sku: SKU_CREDITS_200, amount: 200 },
  { sku: SKU_CREDITS_500, amount: 500 },
  { sku: SKU_CREDITS_1200, amount: 1200 },
];
