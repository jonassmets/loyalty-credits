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

  if (!orderId) {
    console.log("[webhook] Skipping order: no order ID");
    return;
  }

  // ── Idempotency: skip if we already processed this order ──
  const existing = await prisma.loyaltyLog.findFirst({
    where: {
      shop,
      orderId,
      type: "purchase_credit",
    },
  });

  if (existing) {
    console.log(`[webhook] Order ${orderId} already processed, skipping duplicate`);
    return;
  }

  try {
    // ── Write the log FIRST to claim the orderId via unique constraint ──
    // This prevents the race condition where two concurrent webhooks both
    // pass the findFirst check before either writes.
    let logEntry;
    try {
      logEntry = await prisma.loyaltyLog.create({
        data: {
          shop,
          customerId,
          orderId,
          amount: 0, // placeholder — updated after processing
          type: "purchase_credit",
          note: "processing...",
        },
      });
    } catch (createError: any) {
      // Unique constraint violation = another request already claimed this order
      if (
        createError?.code === "P2002" ||
        createError?.message?.includes("Unique constraint")
      ) {
        console.log(`[webhook] Order ${orderId} already claimed by concurrent request, skipping`);
        return;
      }
      throw createError;
    }

    const result = await processOrder(admin, customerId, orderTotal);

    if (!result) {
      // No credit awarded — clean up the placeholder log
      await prisma.loyaltyLog.delete({ where: { id: logEntry.id } });
      console.log("[webhook] No credit awarded (program disabled or zero credit)");
      return;
    }

    // Update the placeholder with the real data
    await prisma.loyaltyLog.update({
      where: { id: logEntry.id },
      data: {
        amount: result.creditAwarded,
        note: `${result.tier.creditPercentage}% of ${orderTotal} (${result.tier.name} tier, 12m spend: ${result.rollingSpend})`,
      },
    });

    console.log(
      `[webhook] Awarded ${result.creditAwarded} store credit to ${customerId} (${result.tier.name} tier)`,
    );
  } catch (error) {
    console.error("[webhook] Error processing order:", error);
  }
}
