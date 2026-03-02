import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, useSubmit, useNavigate } from "react-router";
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
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../loyalty.server";
import { DEFAULT_SETTINGS } from "../loyalty.shared";
import type { LoyaltySettings, LoyaltyTier } from "../loyalty.shared";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
    const settings = await getSettings(admin);
    return { settings };
  } catch (e) {
    console.error("[tiers] Failed to load settings:", e);
    return { settings: DEFAULT_SETTINGS };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const tiersRaw = formData.get("tiers");

  if (typeof tiersRaw !== "string") {
    return { success: false, error: "Invalid form data" };
  }

  try {
    const tiers: LoyaltyTier[] = JSON.parse(tiersRaw);

    // Validate tiers
    if (tiers.length === 0) {
      return { success: false, error: "You need at least one tier" };
    }

    for (let i = 0; i < tiers.length; i++) {
      if (!tiers[i].name?.trim()) {
        return { success: false, error: `Tier ${i + 1} needs a name` };
      }
      if (tiers[i].creditPercentage <= 0 || tiers[i].creditPercentage > 100) {
        return { success: false, error: `"${tiers[i].name}" needs a valid credit percentage (0.1–100%)` };
      }
      if (tiers[i].minSpend < 0) {
        return { success: false, error: `"${tiers[i].name}" minimum spend can't be negative` };
      }
    }

    // Check for duplicate min spends
    const minSpends = tiers.map((t) => t.minSpend);
    if (new Set(minSpends).size !== minSpends.length) {
      return { success: false, error: "Each tier must have a unique minimum spend amount" };
    }

    // Sort by minSpend and set maxSpend automatically
    tiers.sort((a, b) => a.minSpend - b.minSpend);
    for (let i = 0; i < tiers.length; i++) {
      tiers[i].maxSpend = i < tiers.length - 1 ? tiers[i + 1].minSpend : null;
    }

    const currentSettings = await getSettings(admin);
    const result = await saveSettings(admin, { ...currentSettings, tiers });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: "Failed to save tiers" };
  }
};

export default function Tiers() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate();
  const isSaving = navigation.state === "submitting";

  const [tiers, setTiers] = useState<LoyaltyTier[]>(
    settings.tiers.length > 0 ? settings.tiers : DEFAULT_SETTINGS.tiers,
  );

  const handleTierChange = useCallback(
    (index: number, field: keyof LoyaltyTier, value: string) => {
      setTiers((prev) => {
        const updated = [...prev];
        if (field === "name") {
          updated[index] = { ...updated[index], name: value };
        } else if (field === "minSpend") {
          updated[index] = { ...updated[index], minSpend: parseFloat(value) || 0 };
        } else if (field === "creditPercentage") {
          updated[index] = { ...updated[index], creditPercentage: parseFloat(value) || 0 };
        }
        return updated;
      });
    },
    [],
  );

  const addTier = useCallback(() => {
    setTiers((prev) => {
      const lastTier = prev[prev.length - 1];
      const newMinSpend = lastTier
        ? (lastTier.maxSpend || lastTier.minSpend + 500)
        : 0;
      return [
        ...prev,
        {
          name: `Tier ${prev.length + 1}`,
          minSpend: newMinSpend,
          maxSpend: null,
          creditPercentage: Math.min(
            (lastTier?.creditPercentage || 5) + 2,
            50,
          ),
        },
      ];
    });
  }, []);

  const removeTier = useCallback((index: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("tiers", JSON.stringify(tiers));
    submit(formData, { method: "post" });
  }, [tiers, submit]);

  const resetToDefaults = useCallback(() => {
    setTiers(DEFAULT_SETTINGS.tiers);
  }, []);

  // Sort for preview
  const sortedTiers = [...tiers].sort((a, b) => a.minSpend - b.minSpend);

  return (
    <Page
      title="Spending Tiers"
      backAction={{ onAction: () => navigate("/app") }}
      primaryAction={{
        content: "Save tiers",
        onAction: handleSave,
        loading: isSaving,
      }}
      secondaryActions={[
        {
          content: "Reset to defaults",
          onAction: resetToDefaults,
          destructive: true,
        },
      ]}
    >
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner
            title="Tiers saved successfully"
            tone="success"
            onDismiss={() => {}}
          />
        )}
        {actionData?.error && (
          <Banner title={actionData.error} tone="critical" />
        )}

        <Banner tone="info">
          <p>
            <strong>How tiers work:</strong> Each tier defines a spending range
            and the store credit percentage customers earn at that level.
            When a customer's cumulative spending reaches a tier's minimum, they
            automatically move up and earn the higher percentage on future orders.
            {settings.yearlyReset
              ? " Spending resets yearly, so customers restart from the lowest tier each period."
              : " Spending never resets — customers keep their tier forever."}
          </p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    Configure Tiers
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    {tiers.length} tier{tiers.length !== 1 ? "s" : ""}
                  </Text>
                </InlineStack>

                <Text variant="bodyMd" as="p" tone="subdued">
                  Set the minimum cumulative spend for each tier and the store
                  credit percentage earned. The first tier should start at 0.
                  Tiers are sorted automatically by minimum spend. The highest
                  tier has no upper limit.
                </Text>

                <Divider />

                <BlockStack gap="500">
                  {tiers.map((tier, index) => (
                    <Card key={index}>
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone="info">
                              {tier.creditPercentage}% credit
                            </Badge>
                            <Text variant="headingSm" as="h3">
                              {tier.name || `Tier ${index + 1}`}
                            </Text>
                          </InlineStack>
                          {tiers.length > 1 && (
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
                            helpText="Visible to you only"
                          />
                          <TextField
                            label={`Min. spend (${settings.currencyCode})`}
                            type="number"
                            value={tier.minSpend.toString()}
                            onChange={(val) =>
                              handleTierChange(index, "minSpend", val)
                            }
                            autoComplete="off"
                            min={0}
                            helpText="Cumulative spend to reach this tier"
                          />
                          <TextField
                            label="Store credit earned"
                            type="number"
                            value={tier.creditPercentage.toString()}
                            onChange={(val) =>
                              handleTierChange(index, "creditPercentage", val)
                            }
                            suffix="%"
                            autoComplete="off"
                            min={0.1}
                            max={100}
                            step={0.5}
                            helpText="% of order total as credit"
                          />
                        </InlineGrid>
                      </BlockStack>
                    </Card>
                  ))}
                </BlockStack>

                <InlineStack align="start">
                  <Button onClick={addTier}>Add tier</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Preview */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">
                    Tier Preview
                  </Text>
                  <Divider />
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Customer progression through tiers:
                  </Text>
                  <BlockStack gap="200">
                    {sortedTiers.map((tier, index) => {
                      const nextTier = sortedTiers[index + 1];
                      const range = nextTier
                        ? `${settings.currencyCode} ${tier.minSpend} – ${nextTier.minSpend}`
                        : `${settings.currencyCode} ${tier.minSpend}+`;

                      return (
                        <Box
                          key={index}
                          padding="300"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <InlineStack align="space-between">
                            <BlockStack gap="050">
                              <Text variant="headingSm" as="h4">
                                {tier.name}
                              </Text>
                              <Text variant="bodySm" as="p" tone="subdued">
                                {range}
                              </Text>
                            </BlockStack>
                            <Badge tone="success">
                              {tier.creditPercentage}%
                            </Badge>
                          </InlineStack>
                        </Box>
                      );
                    })}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Example calculation */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">
                    Example
                  </Text>
                  <Divider />
                  {sortedTiers.length > 0 && (
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd">
                        A new customer places a {settings.currencyCode} 100 order:
                      </Text>
                      <Box
                        padding="200"
                        background="bg-surface-success"
                        borderRadius="200"
                      >
                        <Text as="p" variant="bodyMd">
                          Earns {settings.currencyCode}{" "}
                          {(100 * (sortedTiers[0]?.creditPercentage || 5) / 100).toFixed(2)}{" "}
                          store credit ({sortedTiers[0]?.name} tier,{" "}
                          {sortedTiers[0]?.creditPercentage}%)
                        </Text>
                      </Box>

                      {sortedTiers.length > 1 && (
                        <>
                          <Text as="p" variant="bodyMd" tone="subdued">
                            After spending {settings.currencyCode}{" "}
                            {sortedTiers[1]?.minSpend}+ total, the same{" "}
                            {settings.currencyCode} 100 order earns:
                          </Text>
                          <Box
                            padding="200"
                            background="bg-surface-success"
                            borderRadius="200"
                          >
                            <Text as="p" variant="bodyMd">
                              {settings.currencyCode}{" "}
                              {(100 * (sortedTiers[1]?.creditPercentage || 7) / 100).toFixed(2)}{" "}
                              store credit ({sortedTiers[1]?.name} tier,{" "}
                              {sortedTiers[1]?.creditPercentage}%)
                            </Text>
                          </Box>
                        </>
                      )}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
