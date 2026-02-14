/**
 * Loyalty Credits - Core server-side logic
 * Manages gift card creation/crediting as store credit mechanism
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { DEFAULT_CONFIG } from "./loyalty.shared";
import type { LoyaltyConfig, LoyaltyTier } from "./loyalty.shared";

export { DEFAULT_CONFIG };
export type { LoyaltyConfig, LoyaltyTier };

// -- Config Management (Shop Metafields) --

export async function getLoyaltyConfig(
  admin: AdminApiContext["admin"],
): Promise<LoyaltyConfig> {
  const response = await admin.graphql(
    `#graphql
    query GetLoyaltyConfig {
      currentAppInstallation {
        metafield(namespace: "$app", key: "loyalty_config") {
          value
        }
      }
    }`,
  );

  const data = await response.json();
  const metafield = data.data?.currentAppInstallation?.metafield;

  if (metafield?.value) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(metafield.value) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  return DEFAULT_CONFIG;
}

export async function saveLoyaltyConfig(
  admin: AdminApiContext["admin"],
  config: LoyaltyConfig,
): Promise<void> {
  const ownerId = await getAppInstallationId(admin);

  await admin.graphql(
    `#graphql
    mutation SaveLoyaltyConfig($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: "$app",
            key: "loyalty_config",
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      },
    },
  );
}

async function getAppInstallationId(
  admin: AdminApiContext["admin"],
): Promise<string> {
  const response = await admin.graphql(
    `#graphql
    query GetAppInstallation {
      currentAppInstallation {
        id
      }
    }`,
  );
  const data = await response.json();
  return data.data!.currentAppInstallation.id;
}

// -- Gift Card Management (Store Credit) --

export async function findCustomerGiftCard(
  admin: AdminApiContext["admin"],
  customerId: string,
): Promise<{ id: string; balance: string } | null> {
  // Check customer metafield for stored gift card ID
  const response = await admin.graphql(
    `#graphql
    query GetCustomerGiftCardId($customerId: ID!) {
      customer(id: $customerId) {
        metafield(namespace: "$app", key: "loyalty_gift_card_id") {
          value
        }
      }
    }`,
    { variables: { customerId } },
  );

  const data = await response.json();
  const giftCardId = data.data?.customer?.metafield?.value;

  if (!giftCardId) return null;

  // Verify the gift card still exists and get balance
  const gcResponse = await admin.graphql(
    `#graphql
    query GetGiftCard($id: ID!) {
      giftCard(id: $id) {
        id
        balance {
          amount
          currencyCode
        }
        enabled
      }
    }`,
    { variables: { id: giftCardId } },
  );

  const gcData = await gcResponse.json();
  const giftCard = gcData.data?.giftCard;

  if (!giftCard || !giftCard.enabled) return null;

  return {
    id: giftCard.id,
    balance: giftCard.balance.amount,
  };
}

export async function addStoreCredit(
  admin: AdminApiContext["admin"],
  customerId: string,
  amount: number,
  note?: string,
): Promise<{ giftCardId: string; newBalance: string }> {
  const existing = await findCustomerGiftCard(admin, customerId);

  if (existing) {
    // Credit existing gift card
    const response = await admin.graphql(
      `#graphql
      mutation CreditGiftCard($id: ID!, $creditInput: GiftCardCreditInput!) {
        giftCardCredit(id: $id, creditInput: $creditInput) {
          giftCard {
            id
            balance {
              amount
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          id: existing.id,
          creditInput: {
            creditAmount: {
              amount: amount,
              currencyCode: "EUR",
            },
            note: note || "Loyalty credit earned",
          },
        },
      },
    );

    const data = await response.json();
    const giftCard = data.data?.giftCardCredit?.giftCard;

    return {
      giftCardId: giftCard?.id || existing.id,
      newBalance: giftCard?.balance?.amount || "0",
    };
  } else {
    // Create new gift card for customer
    const response = await admin.graphql(
      `#graphql
      mutation CreateGiftCard($input: GiftCardCreateInput!) {
        giftCardCreate(input: $input) {
          giftCard {
            id
            balance {
              amount
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: {
            initialValue: amount.toString(),
            customerId,
            note: note || "Loyalty store credit",
          },
        },
      },
    );

    const data = await response.json();
    const giftCard = data.data?.giftCardCreate?.giftCard;

    if (giftCard) {
      // Save gift card ID to customer metafield
      await admin.graphql(
        `#graphql
        mutation SaveCustomerGiftCardId($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            metafields: [
              {
                ownerId: customerId,
                namespace: "$app",
                key: "loyalty_gift_card_id",
                type: "single_line_text_field",
                value: giftCard.id,
              },
            ],
          },
        },
      );
    }

    return {
      giftCardId: giftCard?.id || "",
      newBalance: giftCard?.balance?.amount || "0",
    };
  }
}

// -- Customer Metafield Helpers --

export async function updateCustomerLoyaltyMetafields(
  admin: AdminApiContext["admin"],
  customerId: string,
  totalEarned: number,
  totalSpent: number,
): Promise<void> {
  await admin.graphql(
    `#graphql
    mutation UpdateCustomerLoyalty($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: customerId,
            namespace: "$app",
            key: "loyalty_total_earned",
            type: "number_decimal",
            value: totalEarned.toString(),
          },
          {
            ownerId: customerId,
            namespace: "$app",
            key: "loyalty_total_spent_amount",
            type: "number_decimal",
            value: totalSpent.toString(),
          },
        ],
      },
    },
  );
}

export async function getCustomerLoyaltyData(
  admin: AdminApiContext["admin"],
  customerId: string,
): Promise<{
  totalEarned: number;
  totalSpent: number;
  giftCardId: string | null;
}> {
  const response = await admin.graphql(
    `#graphql
    query GetCustomerLoyaltyData($customerId: ID!) {
      customer(id: $customerId) {
        totalEarned: metafield(namespace: "$app", key: "loyalty_total_earned") {
          value
        }
        totalSpent: metafield(namespace: "$app", key: "loyalty_total_spent_amount") {
          value
        }
        giftCardId: metafield(namespace: "$app", key: "loyalty_gift_card_id") {
          value
        }
      }
    }`,
    { variables: { customerId } },
  );

  const data = await response.json();
  const customer = data.data?.customer;

  return {
    totalEarned: parseFloat(customer?.totalEarned?.value || "0"),
    totalSpent: parseFloat(customer?.totalSpent?.value || "0"),
    giftCardId: customer?.giftCardId?.value || null,
  };
}

// -- Tier Calculation --

export function calculateTier(
  config: LoyaltyConfig,
  totalSpent: number,
): LoyaltyTier {
  if (!config.tierEnabled || config.tiers.length === 0) {
    return {
      name: "Standard",
      minSpent: 0,
      creditPercentage: config.creditPercentage,
    };
  }

  const sortedTiers = [...config.tiers].sort(
    (a, b) => b.minSpent - a.minSpent,
  );

  for (const tier of sortedTiers) {
    if (totalSpent >= tier.minSpent) {
      return tier;
    }
  }

  return sortedTiers[sortedTiers.length - 1];
}

export function calculateCreditAmount(
  orderTotal: number,
  creditPercentage: number,
): number {
  return Math.round(orderTotal * (creditPercentage / 100) * 100) / 100;
}
