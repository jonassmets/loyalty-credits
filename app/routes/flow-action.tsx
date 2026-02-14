import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { addStoreCredit } from "../loyalty.server";
import prisma from "../db.server";

/**
 * Flow Action endpoint: "Add store credit to customer"
 * Receives a POST from Shopify Flow with customer_id and amount.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const body = await request.json();
  const { customer_id, amount, note } = body;

  if (!customer_id || !amount || parseFloat(amount) <= 0) {
    return new Response(
      JSON.stringify({ error: "customer_id and positive amount are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const creditAmount = parseFloat(amount);
    const result = await addStoreCredit(
      admin,
      customer_id,
      creditAmount,
      note || "Credit from Shopify Flow",
    );

    // Log the flow credit
    await prisma.loyaltyLog.create({
      data: {
        shop: session.shop,
        customerId: customer_id,
        amount: creditAmount,
        type: "flow_credit",
        note: note || "Added via Shopify Flow",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        gift_card_id: result.giftCardId,
        new_balance: result.newBalance,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Flow action error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to add store credit" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
