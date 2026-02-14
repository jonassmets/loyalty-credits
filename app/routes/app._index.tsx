import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getLoyaltyConfig, saveLoyaltyConfig } from "../loyalty.server";
import { DEFAULT_CONFIG } from "../loyalty.shared";
import type { LoyaltyConfig, LoyaltyTier } from "../loyalty.shared";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const config = await getLoyaltyConfig(admin);
  return { config };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const configRaw = formData.get("config");

  if (typeof configRaw !== "string") {
    return { success: false, error: "Invalid form data" };
  }

  try {
    const config: LoyaltyConfig = JSON.parse(configRaw);
    await saveLoyaltyConfig(admin, config);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: "Failed to save configuration" };
  }
};

export default function Index() {
  const { config: savedConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = navigation.state === "submitting";

  const [config, setConfig] = useState<LoyaltyConfig>(savedConfig || DEFAULT_CONFIG);

  const handlePercentageChange = useCallback(
    (value: string) => {
      setConfig((prev) => ({
        ...prev,
        creditPercentage: parseFloat(value),
      }));
    },
    [],
  );

  const handleTierToggle = useCallback(
    (checked: boolean) => {
      setConfig((prev) => ({
        ...prev,
        tierEnabled: checked,
      }));
    },
    [],
  );

  const handleTierChange = useCallback(
    (index: number, field: keyof LoyaltyTier, value: string) => {
      setConfig((prev) => {
        const tiers = [...prev.tiers];
        tiers[index] = {
          ...tiers[index],
          [field]: field === "name" ? value : parseFloat(value) || 0,
        };
        return { ...prev, tiers };
      });
    },
    [],
  );

  const addTier = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        {
          name: `Level ${prev.tiers.length + 1}`,
          minSpent: 0,
          creditPercentage: 5,
        },
      ],
    }));
  }, []);

  const removeTier = useCallback((index: number) => {
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("config", JSON.stringify(config));
    submit(formData, { method: "post" });
  }, [config, submit]);

  const percentageOptions = [
    { label: "1%", value: "1" },
    { label: "2%", value: "2" },
    { label: "3%", value: "3" },
    { label: "5%", value: "5" },
    { label: "7.5%", value: "7.5" },
    { label: "10%", value: "10" },
    { label: "15%", value: "15" },
  ];

  return (
    <Page title="Loyalty Credits">
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner
            title="Settings saved successfully"
            tone="success"
            onDismiss={() => {}}
          />
        )}
        {actionData?.error && (
          <Banner title={actionData.error} tone="critical" />
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    Store Credit Settings
                  </Text>
                  <Badge tone="success">Active</Badge>
                </InlineStack>

                <Text variant="bodyMd" as="p" tone="subdued">
                  Configure how much store credit customers earn on purchases.
                  Credit is issued as a gift card that works at checkout and POS.
                </Text>

                <Divider />

                <Select
                  label="Credit percentage on purchases"
                  options={percentageOptions}
                  value={config.creditPercentage.toString()}
                  onChange={handlePercentageChange}
                  helpText="Customers earn this percentage of their order total as store credit."
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Loyalty Tiers
                </Text>

                <Text variant="bodyMd" as="p" tone="subdued">
                  Enable tiers to reward your best customers with higher credit
                  percentages based on their total spending.
                </Text>

                <Checkbox
                  label="Enable loyalty tiers"
                  checked={config.tierEnabled}
                  onChange={handleTierToggle}
                />

                {config.tierEnabled && (
                  <BlockStack gap="400">
                    <Divider />
                    {config.tiers.map((tier, index) => (
                      <Card key={index}>
                        <BlockStack gap="300">
                          <InlineStack
                            align="space-between"
                            blockAlign="center"
                          >
                            <Badge>
                              {tier.name || `Level ${index + 1}`}
                            </Badge>
                            {config.tiers.length > 1 && (
                              <Button
                                variant="plain"
                                tone="critical"
                                onClick={() => removeTier(index)}
                              >
                                Remove
                              </Button>
                            )}
                          </InlineStack>

                          <InlineGrid columns={3} gap="300">
                            <TextField
                              label="Tier name"
                              value={tier.name}
                              onChange={(val) =>
                                handleTierChange(index, "name", val)
                              }
                              autoComplete="off"
                            />
                            <TextField
                              label="Min. spent (EUR)"
                              type="number"
                              value={tier.minSpent.toString()}
                              onChange={(val) =>
                                handleTierChange(index, "minSpent", val)
                              }
                              autoComplete="off"
                            />
                            <TextField
                              label="Credit %"
                              type="number"
                              value={tier.creditPercentage.toString()}
                              onChange={(val) =>
                                handleTierChange(
                                  index,
                                  "creditPercentage",
                                  val,
                                )
                              }
                              suffix="%"
                              autoComplete="off"
                            />
                          </InlineGrid>
                        </BlockStack>
                      </Card>
                    ))}

                    <InlineStack align="start">
                      <Button onClick={addTier}>Add tier</Button>
                    </InlineStack>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  How it works
                </Text>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    1. A customer places an order and pays.
                  </Text>
                  <Text as="p" variant="bodyMd">
                    2. The app calculates store credit based on the order total
                    and the configured percentage.
                  </Text>
                  <Text as="p" variant="bodyMd">
                    3. A gift card is created (or credited) for the customer
                    with the earned amount.
                  </Text>
                  <Text as="p" variant="bodyMd">
                    4. The customer can use this gift card at checkout or POS on
                    their next purchase.
                  </Text>
                </BlockStack>

                <Divider />

                <Text variant="bodyMd" as="p" tone="subdued">
                  Store credit also integrates with Shopify Flow. Use the "Add
                  store credit" action to award credit from review apps, referral
                  programs, and more.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Box paddingBlockEnd="800">
          <InlineStack align="end">
            <Button variant="primary" onClick={handleSave} loading={isLoading}>
              Save settings
            </Button>
          </InlineStack>
        </Box>
      </BlockStack>
    </Page>
  );
}
