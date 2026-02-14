import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { processOrder } from "../loyalty.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  if (!admin) {
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
    console.log("[webhook] Skipping order: no customer or zero total");
    return;
  }

  try {
    const result = await processOrder(admin, customerId, orderTotal);

    if (!result) {
      console.log("[webhook] No credit awarded (program disabled or zero credit)");
      return;
    }

    // Log the credit
    await prisma.loyaltyLog.create({
      data: {
        shop,
        customerId,
        orderId,
        amount: result.creditAwarded,
        type: "purchase_credit",
        note: `${result.tier.creditPercentage}% of ${orderTotal} (${result.tier.name} tier)`,
      },
    });

    console.log(
      `[webhook] Awarded ${result.creditAwarded} store credit to ${customerId} (${result.tier.name} tier)`,
    );
  } catch (error) {
    console.error("[webhook] Error processing order:", error);
  }
}
