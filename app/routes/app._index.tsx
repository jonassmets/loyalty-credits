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
  Icon,
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
    const settings = await getSettings(admin);
    return { settings };
  } catch (e) {
    console.error("[dashboard] Failed to load settings:", e);
    return { settings: DEFAULT_SETTINGS };
  }
};

export default function Dashboard() {
  const { settings } = useLoaderData<typeof loader>();

  return (
    <Page title="Loyalty Credits">
      <BlockStack gap="500">
        {/* Status banner */}
        {settings.enabled ? (
          <Banner title="Your loyalty program is active" tone="success">
            <p>
              Customers earn store credit on every purchase based on their
              spending tier.
            </p>
          </Banner>
        ) : (
          <Banner title="Your loyalty program is disabled" tone="warning">
            <p>
              Enable the program in Settings to start rewarding customers with
              store credit.
            </p>
          </Banner>
        )}

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

          {/* Program info */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">
                    Program Details
                  </Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">Status</Text>
                    <Badge tone={settings.enabled ? "success" : "warning"}>
                      {settings.enabled ? "Active" : "Disabled"}
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
                      {settings.yearlyReset ? "Enabled" : "Disabled"}
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
                </BlockStack>
              </Card>

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
                      2. Their total spending determines their tier.
                    </Text>
                    <Text as="p" variant="bodyMd">
                      3. Store credit is awarded based on the tier percentage.
                    </Text>
                    <Text as="p" variant="bodyMd">
                      4. Credit is available at checkout automatically.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <Text as="p" variant="bodySm" tone="subdued">
                    Uses Shopify native store credit — works at checkout and POS
                    without gift cards.
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
