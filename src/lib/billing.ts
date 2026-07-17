export type SubscriptionPlan = "starter" | "professional" | "agency";

export const PLAN_CREDITS: Record<SubscriptionPlan, number> = {
  starter: 300,
  professional: 1000,
  agency: 3000,
};

export const PLAN_PRICES_USD: Record<SubscriptionPlan, number> = {
  starter: 29,
  professional: 79,
  agency: 149,
};

// Placeholder rate — tune after launch.
export const PRICE_PER_CREDIT_UZS = 1000;

// Placeholder contact number — replace with the real one before launch.
export const ADMIN_CONTACT_PHONE = "+998 90 000 00 00";

export function calculateTopupPriceUzs(credits: number): number {
  return Math.max(0, Math.round(credits)) * PRICE_PER_CREDIT_UZS;
}
