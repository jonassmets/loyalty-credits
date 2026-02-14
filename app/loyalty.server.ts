/**
 * Loyalty Credits - Server-side logic
 * Uses Shopify native store credit for loyalty rewards.
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { DEFAULT_SETTINGS, getTierForSpend, calculateCredit } from "./loyalty.shared";
import type { LoyaltySettings, LoyaltyTier } from "./loyalty.shared";

export { DEFAULT_SETTINGS, getTierForSpend, calculateCredit };
export type { LoyaltySettings, LoyaltyTier };

// ── Settings (stored in app metafields) ────────────────────────────

export async function getSettings(
  admin: AdminApiContext["admin"],
): Promise<LoyaltySettings> {
  const response = await admin.graphql(
    `#graphql
    query GetLoyaltySettings {
      currentAppInstallation {
        metafield(namespace: "$app", key: "loyalty_settings") {
          value
        }
      }
    }`,
  );

  const data = await response.json();
  const raw = data.data?.currentAppInstallation?.metafield?.value;

  if (raw) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(
  admin: AdminApiContext["admin"],
  settings: LoyaltySettings,
): Promise<{ success: boolean; error?: string }> {
  const ownerId = await getAppInstallationId(admin);

  const response = await admin.graphql(
    `#graphql
    mutation SaveLoyaltySettings($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: "$app",
            key: "loyalty_settings",
            type: "json",
            value: JSON.stringify(settings),
          },
        ],
      },
    },
  );

  const data = await response.json();
  const errors = data.data?.metafieldsSet?.userErrors;

  if (errors?.length) {
    return { success: false, error: errors.map((e: any) => e.message).join(", ") };
  }
  return { success: true };
}

async function getAppInstallationId(
  admin: AdminApiContext["admin"],
): Promise<string> {
  const response = await admin.graphql(
    `#graphql
    query GetAppInstallation {
      currentAppInstallation { id }
    }`,
  );
  const data = await response.json();
  return data.data!.currentAppInstallation.id;
}

// ── Store Credit ───────────────────────────────────────────────────

export async function addStoreCredit(
  admin: AdminApiContext["admin"],
  customerId: string,
  amount: number,
  currencyCode: string = "EUR",
): Promise<{ success: boolean; balance?: string; error?: string }> {
  const response = await admin.graphql(
    `#graphql
    mutation CreditStoreCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
      storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
        storeCreditAccountTransaction {
          amount { amount currencyCode }
          balanceAfterTransaction { amount currencyCode }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        id: customerId,
        creditInput: {
          creditAmount: {
            amount: amount.toFixed(2),
            currencyCode,
          },
        },
      },
    },
  );

  const data = await response.json();
  const result = data.data?.storeCreditAccountCredit;
  const errors = result?.userErrors;

  if (errors?.length) {
    return { success: false, error: errors.map((e: any) => e.message).join(", ") };
  }

  return {
    success: true,
    balance: result?.storeCreditAccountTransaction?.balanceAfterTransaction?.amount,
  };
}

// ── Customer Loyalty Data (metafields) ─────────────────────────────

export interface CustomerLoyaltyData {
  totalSpent: number;
  totalEarned: number;
  periodSpent: number;
  storeCreditBalance: string | null;
}

export async function getCustomerLoyaltyData(
  admin: AdminApiContext["admin"],
  customerId: string,
): Promise<CustomerLoyaltyData> {
  const response = await admin.graphql(
    `#graphql
    query GetCustomerLoyaltyData($customerId: ID!) {
      customer(id: $customerId) {
        totalSpent: metafield(namespace: "$app", key: "loyalty_total_spent") {
          value
        }
        totalEarned: metafield(namespace: "$app", key: "loyalty_total_earned") {
          value
        }
        periodSpent: metafield(namespace: "$app", key: "loyalty_period_spent") {
          value
        }
        storeCreditAccounts(first: 1) {
          nodes {
            id
            balance { amount currencyCode }
          }
        }
      }
    }`,
    { variables: { customerId } },
  );

  const data = await response.json();
  const customer = data.data?.customer;
  const account = customer?.storeCreditAccounts?.nodes?.[0];

  return {
    totalSpent: parseFloat(customer?.totalSpent?.value || "0"),
    totalEarned: parseFloat(customer?.totalEarned?.value || "0"),
    periodSpent: parseFloat(customer?.periodSpent?.value || "0"),
    storeCreditBalance: account?.balance?.amount ?? null,
  };
}

export async function updateCustomerSpending(
  admin: AdminApiContext["admin"],
  customerId: string,
  orderAmount: number,
  creditEarned: number,
): Promise<void> {
  // Get current values
  const current = await getCustomerLoyaltyData(admin, customerId);

  await admin.graphql(
    `#graphql
    mutation UpdateCustomerLoyalty($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: customerId,
            namespace: "$app",
            key: "loyalty_total_spent",
            type: "number_decimal",
            value: (current.totalSpent + orderAmount).toString(),
          },
          {
            ownerId: customerId,
            namespace: "$app",
            key: "loyalty_total_earned",
            type: "number_decimal",
            value: (current.totalEarned + creditEarned).toString(),
          },
          {
            ownerId: customerId,
            namespace: "$app",
            key: "loyalty_period_spent",
            type: "number_decimal",
            value: (current.periodSpent + orderAmount).toString(),
          },
        ],
      },
    },
  );
}

// ── Order Processing ───────────────────────────────────────────────

/**
 * Process a paid order: calculate tier, award store credit, update stats.
 */
export async function processOrder(
  admin: AdminApiContext["admin"],
  customerId: string,
  orderTotal: number,
): Promise<{ creditAwarded: number; tier: LoyaltyTier } | null> {
  const settings = await getSettings(admin);

  if (!settings.enabled || settings.tiers.length === 0) {
    return null;
  }

  // Use period spend for tier calculation (respects yearly reset)
  const customerData = await getCustomerLoyaltyData(admin, customerId);
  const spendForTier = settings.yearlyReset
    ? customerData.periodSpent
    : customerData.totalSpent;

  const tier = getTierForSpend(settings.tiers, spendForTier);
  const creditAmount = calculateCredit(orderTotal, tier.creditPercentage);

  if (creditAmount <= 0) return null;

  // Award store credit
  const result = await addStoreCredit(
    admin,
    customerId,
    creditAmount,
    settings.currencyCode,
  );

  if (!result.success) {
    console.error("[loyalty] Failed to award store credit:", result.error);
    return null;
  }

  // Update customer spending metafields
  await updateCustomerSpending(admin, customerId, orderTotal, creditAmount);

  return { creditAwarded: creditAmount, tier };
}
