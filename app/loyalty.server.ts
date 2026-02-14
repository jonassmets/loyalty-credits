/**
 * Loyalty Credits - Server-side logic
 * Uses Shopify native store credit with rolling 12-month tier calculation.
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { DEFAULT_SETTINGS, getTierForSpend, calculateCredit, getExpiryDate } from "./loyalty.shared";
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

// ── Rolling 12-month spend calculation ─────────────────────────────

/**
 * Calculate how much a customer has spent in the last 12 months
 * by looking at actual paid order dates.
 */
export async function getRolling12MonthSpend(
  admin: AdminApiContext["admin"],
  customerId: string,
): Promise<{ totalSpend: number; orderCount: number; lastOrderDate: string | null }> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const dateStr = twelveMonthsAgo.toISOString().split("T")[0]; // YYYY-MM-DD

  const response = await admin.graphql(
    `#graphql
    query GetCustomerOrders($customerId: ID!, $query: String!) {
      customer(id: $customerId) {
        orders(first: 250, query: $query) {
          nodes {
            id
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }`,
    {
      variables: {
        customerId,
        query: `created_at:>${dateStr} financial_status:paid`,
      },
    },
  );

  const data = await response.json();
  const orders = data.data?.customer?.orders?.nodes || [];

  let totalSpend = 0;
  let lastOrderDate: string | null = null;

  for (const order of orders) {
    totalSpend += parseFloat(order.totalPriceSet?.shopMoney?.amount || "0");
    if (!lastOrderDate || order.createdAt > lastOrderDate) {
      lastOrderDate = order.createdAt;
    }
  }

  return {
    totalSpend: Math.round(totalSpend * 100) / 100,
    orderCount: orders.length,
    lastOrderDate,
  };
}

// ── Store Credit ───────────────────────────────────────────────────

export async function addStoreCredit(
  admin: AdminApiContext["admin"],
  customerId: string,
  amount: number,
  currencyCode: string = "EUR",
  expiresAt?: string | null,
): Promise<{ success: boolean; balance?: string; error?: string }> {
  const creditInput: any = {
    creditAmount: {
      amount: amount.toFixed(2),
      currencyCode,
    },
  };

  if (expiresAt) {
    creditInput.expiresAt = expiresAt;
  }

  try {
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
          creditInput,
        },
      },
    );

    const data = await response.json();

    // Check for top-level GraphQL errors (e.g., access denied)
    if (data.errors?.length) {
      const errMsg = data.errors.map((e: any) => e.message).join(", ");
      console.error("[store-credit] GraphQL errors:", errMsg);
      return { success: false, error: errMsg };
    }

    const result = data.data?.storeCreditAccountCredit;
    const userErrors = result?.userErrors;

    if (userErrors?.length) {
      const errMsg = userErrors.map((e: any) => e.message).join(", ");
      console.error("[store-credit] User errors:", errMsg);
      return { success: false, error: errMsg };
    }

    if (!result?.storeCreditAccountTransaction) {
      console.error("[store-credit] No transaction in response:", JSON.stringify(data));
      return { success: false, error: "No transaction returned — check app permissions" };
    }

    return {
      success: true,
      balance: result.storeCreditAccountTransaction.balanceAfterTransaction?.amount,
    };
  } catch (e: any) {
    console.error("[store-credit] Exception:", e);
    return { success: false, error: e?.message || "Store credit API error" };
  }
}

// ── Customer Loyalty Data ──────────────────────────────────────────

export interface CustomerLoyaltyData {
  totalSpent: number;
  totalEarned: number;
  periodSpent: number; // rolling 12-month spend
  storeCreditBalance: string | null;
}

export async function getCustomerLoyaltyData(
  admin: AdminApiContext["admin"],
  customerId: string,
): Promise<CustomerLoyaltyData> {
  // Get metafield data + rolling spend in parallel
  const [metafieldResponse, rollingSpend] = await Promise.all([
    admin.graphql(
      `#graphql
      query GetCustomerLoyaltyData($customerId: ID!) {
        customer(id: $customerId) {
          totalSpent: metafield(namespace: "$app", key: "loyalty_total_spent") {
            value
          }
          totalEarned: metafield(namespace: "$app", key: "loyalty_total_earned") {
            value
          }
        }
      }`,
      { variables: { customerId } },
    ),
    getRolling12MonthSpend(admin, customerId),
  ]);

  const data = await metafieldResponse.json();
  const customer = data.data?.customer;

  // Try to get store credit balance separately (may fail without scope)
  let storeCreditBalance: string | null = null;
  try {
    const scResponse = await admin.graphql(
      `#graphql
      query GetCustomerStoreCredit($customerId: ID!) {
        customer(id: $customerId) {
          storeCreditAccounts(first: 1) {
            nodes {
              balance { amount currencyCode }
            }
          }
        }
      }`,
      { variables: { customerId } },
    );
    const scData = await scResponse.json();
    storeCreditBalance =
      scData.data?.customer?.storeCreditAccounts?.nodes?.[0]?.balance?.amount ?? null;
  } catch {
    // Store credit scope not available yet
  }

  return {
    totalSpent: parseFloat(customer?.totalSpent?.value || "0"),
    totalEarned: parseFloat(customer?.totalEarned?.value || "0"),
    periodSpent: rollingSpend.totalSpend, // Use real order data
    storeCreditBalance,
  };
}

export async function updateCustomerSpending(
  admin: AdminApiContext["admin"],
  customerId: string,
  orderAmount: number,
  creditEarned: number,
): Promise<void> {
  // Get current totals
  const response = await admin.graphql(
    `#graphql
    query GetCustomerTotals($customerId: ID!) {
      customer(id: $customerId) {
        totalSpent: metafield(namespace: "$app", key: "loyalty_total_spent") {
          value
        }
        totalEarned: metafield(namespace: "$app", key: "loyalty_total_earned") {
          value
        }
      }
    }`,
    { variables: { customerId } },
  );

  const data = await response.json();
  const customer = data.data?.customer;
  const currentSpent = parseFloat(customer?.totalSpent?.value || "0");
  const currentEarned = parseFloat(customer?.totalEarned?.value || "0");

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
            value: (currentSpent + orderAmount).toString(),
          },
          {
            ownerId: customerId,
            namespace: "$app",
            key: "loyalty_total_earned",
            type: "number_decimal",
            value: (currentEarned + creditEarned).toString(),
          },
        ],
      },
    },
  );
}

// ── Order Processing ───────────────────────────────────────────────

/**
 * Process a paid order:
 * 1. Calculate rolling 12-month spend (including this order)
 * 2. Determine tier based on that spend
 * 3. Award store credit = tier % of order total
 * 4. Update metafields
 */
export async function processOrder(
  admin: AdminApiContext["admin"],
  customerId: string,
  orderTotal: number,
): Promise<{ creditAwarded: number; tier: LoyaltyTier; rollingSpend: number } | null> {
  const settings = await getSettings(admin);

  if (!settings.enabled || settings.tiers.length === 0) {
    return null;
  }

  // Get rolling 12-month spend (this already includes the paid order)
  const { totalSpend: rollingSpend } = await getRolling12MonthSpend(admin, customerId);

  // Determine tier based on rolling spend
  const tier = getTierForSpend(settings.tiers, rollingSpend);
  const creditAmount = calculateCredit(orderTotal, tier.creditPercentage);

  if (creditAmount <= 0) return null;

  // Calculate expiry date
  const expiryDate = getExpiryDate(settings.creditExpiry || "1_year");
  const expiresAt = expiryDate ? expiryDate.toISOString() : null;

  // Award store credit
  const result = await addStoreCredit(
    admin,
    customerId,
    creditAmount,
    settings.currencyCode,
    expiresAt,
  );

  if (!result.success) {
    console.error("[loyalty] Failed to award store credit:", result.error);
    return null;
  }

  // Update cumulative metafields for tracking
  await updateCustomerSpending(admin, customerId, orderTotal, creditAmount);

  return { creditAwarded: creditAmount, tier, rollingSpend };
}
