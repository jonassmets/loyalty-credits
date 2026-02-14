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
    for (let i = 0; i < tiers.length; i++) {
      if (!tiers[i].name?.trim()) {
        return { success: false, error: `Tier ${i + 1} needs a name` };
      }
      if (tiers[i].creditPercentage <= 0 || tiers[i].creditPercentage > 100) {
        return { success: false, error: `Tier "${tiers[i].name}" has an invalid percentage` };
      }
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
      const newMinSpend = lastTier ? (lastTier.maxSpend || lastTier.minSpend + 500) : 0;
      return [
        ...prev,
        {
          name: `Tier ${prev.length + 1}`,
          minSpend: newMinSpend,
          maxSpend: null,
          creditPercentage: Math.min((lastTier?.creditPercentage || 5) + 2, 50),
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

  // Sort for display and compute ranges
  const sortedTiers = [...tiers].sort((a, b) => a.minSpend - b.minSpend);

  return (
    <Page
      title="Spending Tiers"
      backAction={{ url: "/app" }}
      primaryAction={{
        content: "Save tiers",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner title="Tiers saved successfully" tone="success" onDismiss={() => {}} />
        )}
        {actionData?.error && (
          <Banner title={actionData.error} tone="critical" />
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Configure your loyalty tiers
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Define spending ranges and the store credit percentage customers
                  earn at each level. Tiers are sorted by minimum spend automatically.
                  The highest tier has no upper limit.
                </Text>

                <Divider />

                <BlockStack gap="500">
                  {tiers.map((tier, index) => (
                    <Card key={index}>
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone="info">{tier.creditPercentage}% credit</Badge>
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
                            onChange={(val) => handleTierChange(index, "name", val)}
                            autoComplete="off"
                          />
                          <TextField
                            label={`Minimum spend (${settings.currencyCode})`}
                            type="number"
                            value={tier.minSpend.toString()}
                            onChange={(val) => handleTierChange(index, "minSpend", val)}
                            autoComplete="off"
                            min={0}
                          />
                          <TextField
                            label="Store credit %"
                            type="number"
                            value={tier.creditPercentage.toString()}
                            onChange={(val) => handleTierChange(index, "creditPercentage", val)}
                            suffix="%"
                            autoComplete="off"
                            min={0.1}
                            max={100}
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
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Preview</Text>
                <Divider />
                <Text variant="bodyMd" as="p" tone="subdued">
                  This is how customers will progress through tiers:
                </Text>
                <BlockStack gap="200">
                  {sortedTiers.map((tier, index) => {
                    const nextTier = sortedTiers[index + 1];
                    const range = nextTier
                      ? `${settings.currencyCode} ${tier.minSpend} – ${nextTier.minSpend}`
                      : `${settings.currencyCode} ${tier.minSpend}+`;

                    return (
                      <Box key={index} padding="200" background="bg-surface-secondary" borderRadius="200">
                        <InlineStack align="space-between">
                          <BlockStack gap="050">
                            <Text variant="headingSm" as="h4">{tier.name}</Text>
                            <Text variant="bodySm" as="p" tone="subdued">{range}</Text>
                          </BlockStack>
                          <Badge tone="success">{tier.creditPercentage}%</Badge>
                        </InlineStack>
                      </Box>
                    );
                  })}
                </BlockStack>

                {sortedTiers.length > 0 && (
                  <>
                    <Divider />
                    <Text variant="bodySm" as="p" tone="subdued">
                      Example: A customer who has spent {settings.currencyCode}{" "}
                      {sortedTiers[sortedTiers.length - 1]?.minSpend || 1000}+ earns{" "}
                      {sortedTiers[sortedTiers.length - 1]?.creditPercentage || 10}%
                      store credit on every order.
                    </Text>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
