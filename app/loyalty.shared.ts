/**
 * Loyalty Credits - Shared types and constants
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

export interface LoyaltySettings {
  enabled: boolean;
  tiers: LoyaltyTier[];
  yearlyReset: boolean;
  resetMonth: number; // 1 = January, 12 = December
  currencyCode: string;
  bonuses: BonusSettings;
}

export const DEFAULT_SETTINGS: LoyaltySettings = {
  enabled: true,
  tiers: [
    { name: "Bronze", minSpend: 0, maxSpend: 500, creditPercentage: 5 },
    { name: "Silver", minSpend: 500, maxSpend: 1000, creditPercentage: 7 },
    { name: "Gold", minSpend: 1000, maxSpend: null, creditPercentage: 10 },
  ],
  yearlyReset: true,
  resetMonth: 1, // January
  currencyCode: "EUR",
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

export const MONTH_OPTIONS = [
  { label: "January", value: "1" },
  { label: "February", value: "2" },
  { label: "March", value: "3" },
  { label: "April", value: "4" },
  { label: "May", value: "5" },
  { label: "June", value: "6" },
  { label: "July", value: "7" },
  { label: "August", value: "8" },
  { label: "September", value: "9" },
  { label: "October", value: "10" },
  { label: "November", value: "11" },
  { label: "December", value: "12" },
];

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
