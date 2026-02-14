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

  // Fetch stats from LoyaltyLog
  let stats = {
    totalCreditsAwarded: 0,
    totalTransactions: 0,
    uniqueCustomers: 0,
    last30DaysCredits: 0,
    last30DaysTransactions: 0,
  };

  let recentActivity: Array<{
    id: string;
    customerId: string;
    amount: number;
    type: string;
    note: string | null;
    createdAt: string;
  }> = [];

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
        take: 10,
      }),
    ]);

    stats = {
      totalCreditsAwarded: allLogs._sum.amount || 0,
      totalTransactions: allLogs._count,
      uniqueCustomers: uniqueCount.length,
      last30DaysCredits: recentLogs._sum.amount || 0,
      last30DaysTransactions: recentLogs._count,
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

  return { settings, stats, recentActivity };
};

export default function Dashboard() {
  const { settings, stats, recentActivity } = useLoaderData<typeof loader>();

  return (
    <Page title="Loyalty Credits">
      <BlockStack gap="500">
        {/* Status banner */}
        {settings.enabled ? (
          <Banner title="Your loyalty program is active" tone="success">
            <p>
              Customers earn store credit on every purchase based on their
              spending tier. Credit is delivered via Shopify's native store
              credit system.
            </p>
          </Banner>
        ) : (
          <Banner title="Your loyalty program is paused" tone="warning">
            <p>
              No store credit is being awarded. Go to{" "}
              <Link to="/app/settings">Settings</Link> to enable the program.
            </p>
          </Banner>
        )}

        {/* Stats cards */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" tone="subdued">
                Total Credits Awarded
              </Text>
              <Text variant="headingLg" as="p">
                {settings.currencyCode}{" "}
                {stats.totalCreditsAwarded.toFixed(2)}
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                across {stats.totalTransactions} transactions
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
                Unique Customers
              </Text>
              <Text variant="headingLg" as="p">
                {stats.uniqueCustomers}
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                customers earned credits
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" tone="subdued">
                Active Tiers
              </Text>
              <Text variant="headingLg" as="p">
                {settings.tiers.length}
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                {settings.tiers.map((t) => t.name).join(", ") || "None configured"}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          {/* Tier overview */}
          <Layout.Section>
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
                  Customers move up tiers as they spend more. Higher tiers earn
                  more store credit per purchase.
                </Text>

                <Divider />

                <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                  {settings.tiers.map((tier, index) => (
                    <Card key={index}>
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingSm" as="h3">
                            {tier.name}
                          </Text>
                          <Badge tone="info">{tier.creditPercentage}%</Badge>
                        </InlineStack>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {tier.maxSpend
                            ? `${settings.currencyCode} ${tier.minSpend} – ${tier.maxSpend}`
                            : `${settings.currencyCode} ${tier.minSpend}+`}
                        </Text>
                      </BlockStack>
                    </Card>
                  ))}
                </InlineGrid>

                {settings.tiers.length === 0 && (
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
          </Layout.Section>

          {/* Sidebar */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Program details */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">
                    Program Details
                  </Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">Status</Text>
                    <Badge tone={settings.enabled ? "success" : "warning"}>
                      {settings.enabled ? "Active" : "Paused"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">Currency</Text>
                    <Text as="span" fontWeight="semibold">
                      {settings.currencyCode}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">Yearly reset</Text>
                    <Badge tone={settings.yearlyReset ? "info" : "enabled"}>
                      {settings.yearlyReset ? "Enabled" : "Off"}
                    </Badge>
                  </InlineStack>
                  {settings.yearlyReset && (
                    <InlineStack align="space-between">
                      <Text as="span" tone="subdued">Resets in</Text>
                      <Text as="span" fontWeight="semibold">
                        {new Date(2026, settings.resetMonth - 1).toLocaleString(
                          "en",
                          { month: "long" },
                        )}
                      </Text>
                    </InlineStack>
                  )}
                  <Divider />
                  <Link to="/app/settings">
                    <Button variant="plain" fullWidth>
                      Manage settings
                    </Button>
                  </Link>
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
                      {recentActivity.slice(0, 5).map((item) => (
                        <Box key={item.id} padding="100">
                          <InlineStack align="space-between">
                            <BlockStack gap="050">
                              <Text variant="bodySm" as="p">
                                +{settings.currencyCode} {item.amount.toFixed(2)}
                              </Text>
                              <Text variant="bodySm" as="p" tone="subdued">
                                {item.note || item.type.replace(/_/g, " ")}
                              </Text>
                            </BlockStack>
                            <Text variant="bodySm" as="p" tone="subdued">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </Text>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  ) : (
                    <Text variant="bodySm" as="p" tone="subdued">
                      No activity yet. Credits will appear here once customers
                      start making purchases.
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
                    <Text as="p" variant="bodyMd">
                      1. Customer places an order and pays.
                    </Text>
                    <Text as="p" variant="bodyMd">
                      2. Their cumulative spending determines their tier.
                    </Text>
                    <Text as="p" variant="bodyMd">
                      3. Store credit is awarded based on the tier's percentage.
                    </Text>
                    <Text as="p" variant="bodyMd">
                      4. Credit appears in their account automatically.
                    </Text>
                    <Text as="p" variant="bodyMd">
                      5. They can redeem at checkout or POS.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <Text as="p" variant="bodySm" tone="subdued">
                    Powered by Shopify native store credit. No gift cards
                    needed — works seamlessly at checkout, on Shop Pay, and at
                    POS terminals.
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
