/**
 * CreditClub - Shared types and constants
 * Safe to import from both server and client code.
 */

export interface LoyaltyTier {
  name: string;
  minSpend: number;
  maxSpend: number | null; // null = unlimited (top tier)
  creditPercentage: number;
}

export interface BonusSettings {
  referralEnabled: boolean;
  referralAmount: number; // fixed credit for referrer
  referralNewCustomerAmount: number; // fixed credit for new customer
  milestoneEnabled: boolean;
  milestones: MilestoneBonus[];
}

export interface MilestoneBonus {
  spendThreshold: number; // cumulative spend to trigger
  bonusAmount: number; // one-time credit award
  label: string; // e.g. "500 EUR Club"
}

export type CreditExpiryOption = "never" | "1_month" | "3_months" | "6_months" | "1_year";

export interface LoyaltySettings {
  enabled: boolean;
  tiers: LoyaltyTier[];
  /** Rolling 12-month window for tier calculation (always true) */
  rollingWindow: boolean;
  currencyCode: string;
  /** When store credit expires after being awarded */
  creditExpiry: CreditExpiryOption;
  bonuses: BonusSettings;
  /** Merchant has confirmed the storefront widget is added to their theme */
  widgetInstalled?: boolean;
  // Legacy fields for backwards compatibility
  yearlyReset?: boolean;
  resetMonth?: number;
}

export const CREDIT_EXPIRY_OPTIONS: { label: string; value: CreditExpiryOption }[] = [
  { label: "Never expires", value: "never" },
  { label: "1 month", value: "1_month" },
  { label: "3 months", value: "3_months" },
  { label: "6 months", value: "6_months" },
  { label: "1 year", value: "1_year" },
];

export const DEFAULT_SETTINGS: LoyaltySettings = {
  enabled: true,
  tiers: [
    { name: "Bronze", minSpend: 0, maxSpend: 5000, creditPercentage: 5 },
    { name: "Silver", minSpend: 5000, maxSpend: 10000, creditPercentage: 7 },
    { name: "Gold", minSpend: 10000, maxSpend: null, creditPercentage: 10 },
  ],
  rollingWindow: true,
  currencyCode: "EUR",
  creditExpiry: "1_year",
  bonuses: {
    referralEnabled: false,
    referralAmount: 10,
    referralNewCustomerAmount: 5,
    milestoneEnabled: false,
    milestones: [
      { spendThreshold: 500, bonusAmount: 25, label: "500 Club" },
      { spendThreshold: 1000, bonusAmount: 50, label: "1000 Club" },
      { spendThreshold: 2500, bonusAmount: 100, label: "VIP Club" },
    ],
  },
};

/**
 * Calculate the expiry date from a CreditExpiryOption.
 * Returns null if "never".
 */
export function getExpiryDate(option: CreditExpiryOption): Date | null {
  if (option === "never") return null;
  const now = new Date();
  switch (option) {
    case "1_month":
      now.setMonth(now.getMonth() + 1);
      return now;
    case "3_months":
      now.setMonth(now.getMonth() + 3);
      return now;
    case "6_months":
      now.setMonth(now.getMonth() + 6);
      return now;
    case "1_year":
      now.setFullYear(now.getFullYear() + 1);
      return now;
    default:
      return null;
  }
}

/**
 * Given a total spend amount, find the matching tier.
 */
export function getTierForSpend(
  tiers: LoyaltyTier[],
  totalSpend: number,
): LoyaltyTier {
  const sorted = [...tiers].sort((a, b) => b.minSpend - a.minSpend);
  for (const tier of sorted) {
    if (totalSpend >= tier.minSpend) {
      return tier;
    }
  }
  return sorted[sorted.length - 1];
}

/**
 * Calculate the credit amount for an order.
 */
export function calculateCredit(
  orderTotal: number,
  creditPercentage: number,
): number {
  return Math.round(orderTotal * (creditPercentage / 100) * 100) / 100;
}
