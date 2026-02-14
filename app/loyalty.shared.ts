/**
 * Loyalty Credits - Shared types and constants
 * Safe to import from both server and client code.
 */

export interface LoyaltyTier {
  name: string;
  minSpent: number;
  creditPercentage: number;
}

export interface LoyaltyConfig {
  creditPercentage: number;
  tierEnabled: boolean;
  tiers: LoyaltyTier[];
}

export const DEFAULT_CONFIG: LoyaltyConfig = {
  creditPercentage: 5,
  tierEnabled: false,
  tiers: [
    { name: "Level 1", minSpent: 0, creditPercentage: 5 },
    { name: "Level 2", minSpent: 500, creditPercentage: 7.5 },
    { name: "Level 3", minSpent: 1000, creditPercentage: 10 },
  ],
};
