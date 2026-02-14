import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  addStoreCredit,
  calculateCreditAmount,
  calculateTier,
  getCustomerLoyaltyData,
  getLoyaltyConfig,
  updateCustomerLoyaltyMetafields,
} from "../loyalty.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  if (!admin) {
    // App was uninstalled or session invalid
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED": {
      if (session) {
        await prisma.session.deleteMany({ where: { shop } });
      }
      break;
    }

    case "ORDERS_PAID": {
      await handleOrderPaid(admin, shop, payload);
      break;
    }

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // Handle mandatory compliance webhooks
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};

async function handleOrderPaid(admin: any, shop: string, payload: any) {
  const customerId = payload.customer?.admin_graphql_api_id;
  const orderId = payload.admin_graphql_api_id;
  const orderTotal = parseFloat(payload.total_price || "0");

  if (!customerId || orderTotal <= 0) {
    console.log("Skipping order: no customer or zero total");
    return;
  }

  try {
    // 1. Get loyalty config
    const config = await getLoyaltyConfig(admin);

    // 2. Get customer loyalty data
    const loyaltyData = await getCustomerLoyaltyData(admin, customerId);
    const newTotalSpent = loyaltyData.totalSpent + orderTotal;

    // 3. Determine tier and credit percentage
    const tier = calculateTier(config, newTotalSpent);
    const creditAmount = calculateCreditAmount(orderTotal, tier.creditPercentage);

    if (creditAmount <= 0) {
      return;
    }

    // 4. Add store credit (create/credit gift card)
    const result = await addStoreCredit(
      admin,
      customerId,
      creditAmount,
      `Earned from order ${payload.name || orderId}`,
    );

    // 5. Update customer metafields
    const newTotalEarned = loyaltyData.totalEarned + creditAmount;
    await updateCustomerLoyaltyMetafields(
      admin,
      customerId,
      newTotalEarned,
      newTotalSpent,
    );

    // 6. Log the credit
    await prisma.loyaltyLog.create({
      data: {
        shop,
        customerId,
        orderId,
        amount: creditAmount,
        type: "purchase_credit",
        note: `${tier.creditPercentage}% of ${orderTotal} EUR (${tier.name})`,
      },
    });

    // 7. Fire Flow trigger
    try {
      await admin.graphql(
        `#graphql
        mutation FlowTrigger($handle: String!, $payload: JSON!) {
          flowTriggerReceive(handle: $handle, payload: $payload) {
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            handle: "store-credit-earned",
            payload: JSON.stringify({
              customer_id: customerId,
              amount: creditAmount,
              order_id: orderId,
              tier_name: tier.name,
              credit_percentage: tier.creditPercentage,
            }),
          },
        },
      );
    } catch (flowError) {
      // Flow trigger is optional, don't fail the whole process
      console.error("Flow trigger failed:", flowError);
    }

    console.log(
      `Loyalty credit: ${creditAmount} EUR for customer ${customerId} from order ${orderId}`,
    );
  } catch (error) {
    console.error("Error processing loyalty credit:", error);
  }
}
