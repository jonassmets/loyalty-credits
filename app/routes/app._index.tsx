import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getSettings } from "../loyalty.server";
import { DEFAULT_SETTINGS } from "../loyalty.shared";
import type { LoyaltySettings } from "../loyalty.shared";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  let settings: LoyaltySettings;
  try {
    settings = await getSettings(admin);
  } catch (e) {
    console.error("[dashboard] Failed to load settings:", e);
    settings = DEFAULT_SETTINGS;
  }

  // Stats
  let stats = {
    totalCreditsAwarded: 0,
    totalTransactions: 0,
    uniqueCustomers: 0,
    last30DaysCredits: 0,
    last30DaysTransactions: 0,
    avgCreditPerTransaction: 0,
  };

  let recentActivity: Array<{
    id: string;
    customerId: string;
    amount: number;
    type: string;
    note: string | null;
    createdAt: string;
  }> = [];

  // Setup checklist
  const setupChecks = {
    hasTiers: settings.tiers.length > 0,
    isEnabled: settings.enabled,
    hasWebhook: true, // Assume registered if app is installed
  };

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [allLogs, recentLogs, uniqueCount, recentItems] = await Promise.all([
      prisma.loyaltyLog.aggregate({
        where: { shop: session.shop },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.loyaltyLog.aggregate({
        where: { shop: session.shop, createdAt: { gte: thirtyDaysAgo } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.loyaltyLog.groupBy({
        by: ["customerId"],
        where: { shop: session.shop },
      }),
      prisma.loyaltyLog.findMany({
        where: { shop: session.shop },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    const totalAmount = allLogs._sum.amount || 0;
    const totalCount = allLogs._count;

    stats = {
      totalCreditsAwarded: totalAmount,
      totalTransactions: totalCount,
      uniqueCustomers: uniqueCount.length,
      last30DaysCredits: recentLogs._sum.amount || 0,
      last30DaysTransactions: recentLogs._count,
      avgCreditPerTransaction: totalCount > 0 ? totalAmount / totalCount : 0,
    };

    recentActivity = recentItems.map((item) => ({
      id: item.id,
      customerId: item.customerId,
      amount: item.amount,
      type: item.type,
      note: item.note,
      createdAt: item.createdAt.toISOString(),
    }));
  } catch (e) {
    console.error("[dashboard] Failed to load stats:", e);
  }

  return { settings, stats, recentActivity, setupChecks };
};

function formatType(type: string): string {
  const map: Record<string, string> = {
    purchase_credit: "Purchase",
    manual_credit: "Manual",
    flow_credit: "Flow",
    referral_credit: "Referral",
    birthday_credit: "Birthday",
  };
  return map[type] || type.replace(/_/g, " ");
}

export default function Dashboard() {
  const { settings, stats, recentActivity, setupChecks } =
    useLoaderData<typeof loader>();

  const allSetUp =
    setupChecks.hasTiers && setupChecks.isEnabled;

  return (
    <Page title="Loyalty Credits">
      <BlockStack gap="500">
        {/* Setup guide for new installs */}
        {!allSetUp && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Getting started
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Complete these steps to start rewarding your customers:
              </Text>
              <Divider />
              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="center">
                  <Badge tone={setupChecks.hasTiers ? "success" : "attention"}>
                    {setupChecks.hasTiers ? "Done" : "To do"}
                  </Badge>
                  <BlockStack gap="050">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Configure spending tiers
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Set up credit percentages for different spending levels
                    </Text>
                  </BlockStack>
                  {!setupChecks.hasTiers && (
                    <Link to="/app/tiers">
                      <Button size="slim">Set up</Button>
                    </Link>
                  )}
                </InlineStack>

                <InlineStack gap="300" blockAlign="center">
                  <Badge tone={setupChecks.isEnabled ? "success" : "attention"}>
                    {setupChecks.isEnabled ? "Done" : "To do"}
                  </Badge>
                  <BlockStack gap="050">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Enable the loyalty program
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Activate automatic store credit on orders
                    </Text>
                  </BlockStack>
                  {!setupChecks.isEnabled && (
                    <Link to="/app/settings">
                      <Button size="slim">Enable</Button>
                    </Link>
                  )}
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        {/* Status */}
        {settings.enabled ? (
          <Banner title="Your loyalty program is active" tone="success">
            <p>
              Customers earn native Shopify store credit on every purchase.
              Credit is usable at checkout, on Shop Pay, and at POS.
            </p>
          </Banner>
        ) : (
          <Banner title="Program paused" tone="warning">
            <p>
              No credit is being awarded. Enable it in{" "}
              <Link to="/app/settings">Settings</Link>.
            </p>
          </Banner>
        )}

        {/* Stats row */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" tone="subdued">
                Total Awarded
              </Text>
              <Text variant="headingLg" as="p">
                {settings.currencyCode}{" "}
                {stats.totalCreditsAwarded.toFixed(2)}
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                {stats.totalTransactions} transactions
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" tone="subdued">
                Last 30 Days
              </Text>
              <Text variant="headingLg" as="p">
                {settings.currencyCode}{" "}
                {stats.last30DaysCredits.toFixed(2)}
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                {stats.last30DaysTransactions} transactions
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" tone="subdued">
                Customers
              </Text>
              <Text variant="headingLg" as="p">
                {stats.uniqueCustomers}
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                earning loyalty credits
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" tone="subdued">
                Avg. Credit
              </Text>
              <Text variant="headingLg" as="p">
                {settings.currencyCode}{" "}
                {stats.avgCreditPerTransaction.toFixed(2)}
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                per transaction
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          {/* Main content */}
          <Layout.Section>
            <BlockStack gap="400">
              {/* Tiers overview */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingMd" as="h2">
                      Spending Tiers
                    </Text>
                    <Link to="/app/tiers">
                      <Button variant="plain">Edit tiers</Button>
                    </Link>
                  </InlineStack>

                  <Text variant="bodyMd" as="p" tone="subdued">
                    Customers move up tiers as they spend more and earn
                    higher credit percentages.
                  </Text>

                  <Divider />

                  {settings.tiers.length > 0 ? (
                    <InlineGrid
                      columns={{ xs: 1, sm: 2, md: 3 }}
                      gap="400"
                    >
                      {settings.tiers.map((tier, index) => {
                        const nextTier = settings.tiers
                          .filter((t) => t.minSpend > tier.minSpend)
                          .sort((a, b) => a.minSpend - b.minSpend)[0];
                        const range = nextTier
                          ? `${settings.currencyCode} ${tier.minSpend} – ${nextTier.minSpend}`
                          : `${settings.currencyCode} ${tier.minSpend}+`;

                        return (
                          <Card key={index}>
                            <BlockStack gap="200">
                              <InlineStack
                                align="space-between"
                                blockAlign="center"
                              >
                                <Text variant="headingSm" as="h3">
                                  {tier.name}
                                </Text>
                                <Badge tone="info">
                                  {tier.creditPercentage}%
                                </Badge>
                              </InlineStack>
                              <Text variant="bodySm" as="p" tone="subdued">
                                {range}
                              </Text>
                              <Text variant="bodySm" as="p">
                                A {settings.currencyCode} 100 order earns{" "}
                                {settings.currencyCode}{" "}
                                {(100 * tier.creditPercentage / 100).toFixed(2)}{" "}
                                credit
                              </Text>
                            </BlockStack>
                          </Card>
                        );
                      })}
                    </InlineGrid>
                  ) : (
                    <Box padding="400">
                      <BlockStack gap="200" inlineAlign="center">
                        <Text variant="bodyMd" as="p" tone="subdued">
                          No tiers configured yet.
                        </Text>
                        <Link to="/app/tiers">
                          <Button>Set up tiers</Button>
                        </Link>
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Card>

              {/* Quick actions */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Quick Actions
                  </Text>
                  <Divider />
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                    <Link to="/app/customers">
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <BlockStack gap="100">
                          <Text variant="headingSm" as="h3">
                            Search Customers
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            Look up loyalty data, add manual credits
                          </Text>
                        </BlockStack>
                      </Box>
                    </Link>
                    <Link to="/app/activity">
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <BlockStack gap="100">
                          <Text variant="headingSm" as="h3">
                            View Activity
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            Transaction history and credit breakdown
                          </Text>
                        </BlockStack>
                      </Box>
                    </Link>
                    <Link to="/app/tiers">
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <BlockStack gap="100">
                          <Text variant="headingSm" as="h3">
                            Edit Tiers
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            Adjust spending ranges and credit rates
                          </Text>
                        </BlockStack>
                      </Box>
                    </Link>
                    <Link to="/app/settings">
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <BlockStack gap="100">
                          <Text variant="headingSm" as="h3">
                            Settings
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            Program options, currency, yearly reset
                          </Text>
                        </BlockStack>
                      </Box>
                    </Link>
                  </InlineGrid>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Sidebar */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Program details */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">
                    Program
                  </Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">
                      Status
                    </Text>
                    <Badge tone={settings.enabled ? "success" : "warning"}>
                      {settings.enabled ? "Active" : "Paused"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">
                      Currency
                    </Text>
                    <Text as="span" fontWeight="semibold">
                      {settings.currencyCode}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">
                      Yearly reset
                    </Text>
                    <Badge tone={settings.yearlyReset ? "info" : "enabled"}>
                      {settings.yearlyReset ? "On" : "Off"}
                    </Badge>
                  </InlineStack>
                  {settings.yearlyReset && (
                    <InlineStack align="space-between">
                      <Text as="span" tone="subdued">
                        Resets in
                      </Text>
                      <Text as="span" fontWeight="semibold">
                        {new Date(2026, settings.resetMonth - 1).toLocaleString(
                          "en",
                          { month: "long" },
                        )}
                      </Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>

              {/* Recent activity */}
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingMd" as="h2">
                      Recent Activity
                    </Text>
                    <Link to="/app/activity">
                      <Button variant="plain">View all</Button>
                    </Link>
                  </InlineStack>
                  <Divider />
                  {recentActivity.length > 0 ? (
                    <BlockStack gap="200">
                      {recentActivity.map((item) => (
                        <Box key={item.id} paddingBlockStart="100" paddingBlockEnd="100">
                          <InlineStack align="space-between">
                            <BlockStack gap="050">
                              <InlineStack gap="100" blockAlign="center">
                                <Text variant="bodySm" as="p" fontWeight="semibold">
                                  +{settings.currencyCode}{" "}
                                  {item.amount.toFixed(2)}
                                </Text>
                                <Badge tone="info">
                                  {formatType(item.type)}
                                </Badge>
                              </InlineStack>
                              <Text variant="bodySm" as="p" tone="subdued">
                                {item.note?.substring(0, 40) || "—"}
                              </Text>
                            </BlockStack>
                            <Text variant="bodySm" as="p" tone="subdued">
                              {new Date(item.createdAt).toLocaleDateString(
                                "en-GB",
                                { day: "numeric", month: "short" },
                              )}
                            </Text>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  ) : (
                    <Text variant="bodySm" as="p" tone="subdued">
                      No activity yet. Credits appear here when customers
                      make purchases.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              {/* How it works */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">
                    How it works
                  </Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm">
                      1. Customer places an order and pays
                    </Text>
                    <Text as="p" variant="bodySm">
                      2. Their cumulative spending determines their tier
                    </Text>
                    <Text as="p" variant="bodySm">
                      3. Store credit is awarded based on the tier %
                    </Text>
                    <Text as="p" variant="bodySm">
                      4. Credit appears in their account instantly
                    </Text>
                    <Text as="p" variant="bodySm">
                      5. They redeem at checkout or POS
                    </Text>
                  </BlockStack>
                  <Divider />
                  <Text as="p" variant="bodySm" tone="subdued">
                    Native Shopify store credit — no gift cards, works
                    at checkout, Shop Pay, and POS.
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
