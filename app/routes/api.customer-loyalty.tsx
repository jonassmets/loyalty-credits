import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getSettings, getCustomerLoyaltyData } from "../loyalty.server";
import { getTierForSpend } from "../loyalty.shared";
import prisma from "../db.server";

/**
 * API endpoint for customer account extensions.
 * Called by the customer-facing UI extensions to get loyalty data.
 *
 * GET /api/customer-loyalty?customerId=gid://shopify/Customer/123
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Authenticate as admin (the request comes through the app proxy or direct)
  try {
    const { admin, session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId");

    if (!customerId) {
      return Response.json({ error: "Missing customerId" }, { status: 400 });
    }

    const [settings, loyaltyData] = await Promise.all([
      getSettings(admin),
      getCustomerLoyaltyData(admin, customerId),
    ]);

    const spendForTier = settings.yearlyReset
      ? loyaltyData.periodSpent
      : loyaltyData.totalSpent;

    const sortedTiers = [...settings.tiers].sort(
      (a, b) => a.minSpend - b.minSpend,
    );
    const tier =
      sortedTiers.length > 0 ? getTierForSpend(sortedTiers, spendForTier) : null;
    const tierIndex = tier
      ? sortedTiers.findIndex((t) => t.minSpend === tier.minSpend)
      : -1;
    const nextTier =
      tierIndex >= 0 && tierIndex < sortedTiers.length - 1
        ? sortedTiers[tierIndex + 1]
        : null;

    // Recent activity
    let recentActivity: Array<{
      date: string;
      note: string;
      amount: number;
    }> = [];

    try {
      const logs = await prisma.loyaltyLog.findMany({
        where: { shop: session.shop, customerId },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      recentActivity = logs.map((log) => ({
        date: log.createdAt.toISOString().split("T")[0],
        note: log.note || log.type.replace(/_/g, " "),
        amount: log.amount,
      }));
    } catch {}

    return Response.json({
      balance: loyaltyData.storeCreditBalance || "0",
      totalEarned: loyaltyData.totalEarned,
      totalSpent: loyaltyData.totalSpent,
      periodSpent: loyaltyData.periodSpent,
      tier: tier
        ? {
            name: tier.name,
            creditPercentage: tier.creditPercentage,
          }
        : { name: "Member", creditPercentage: 0 },
      nextTier: nextTier
        ? {
            name: nextTier.name,
            minSpend: nextTier.minSpend,
            amountToReach: Math.max(0, nextTier.minSpend - spendForTier),
          }
        : null,
      tiers: sortedTiers.map((t) => ({
        name: t.name,
        minSpend: t.minSpend,
        creditPercentage: t.creditPercentage,
        isCurrent: tier ? t.minSpend === tier.minSpend : false,
      })),
      currencyCode: settings.currencyCode,
      recentActivity,
    });
  } catch (error) {
    // If auth fails, return empty data
    console.error("[api.customer-loyalty] Error:", error);
    return Response.json(
      { error: "Unable to load loyalty data" },
      { status: 401 },
    );
  }
};
