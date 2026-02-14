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
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../loyalty.server";
import { DEFAULT_SETTINGS } from "../loyalty.shared";
import type { BonusSettings, MilestoneBonus } from "../loyalty.shared";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
    const settings = await getSettings(admin);
    return { settings };
  } catch (e) {
    return { settings: DEFAULT_SETTINGS };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const bonusesRaw = formData.get("bonuses");

  if (typeof bonusesRaw !== "string") {
    return { success: false, error: "Invalid form data" };
  }

  try {
    const bonuses: BonusSettings = JSON.parse(bonusesRaw);
    const currentSettings = await getSettings(admin);
    const result = await saveSettings(admin, { ...currentSettings, bonuses });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Failed to save bonus settings" };
  }
};

export default function Bonuses() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSaving = navigation.state === "submitting";

  const defaults = DEFAULT_SETTINGS.bonuses;
  const saved = settings.bonuses || defaults;

  const [referralEnabled, setReferralEnabled] = useState(saved.referralEnabled);
  const [referralAmount, setReferralAmount] = useState(saved.referralAmount.toString());
  const [referralNewAmount, setReferralNewAmount] = useState(
    saved.referralNewCustomerAmount.toString(),
  );

  const [milestoneEnabled, setMilestoneEnabled] = useState(saved.milestoneEnabled);
  const [milestones, setMilestones] = useState<MilestoneBonus[]>(
    saved.milestones.length > 0 ? saved.milestones : defaults.milestones,
  );

  const handleMilestoneChange = useCallback(
    (index: number, field: keyof MilestoneBonus, value: string) => {
      setMilestones((prev) => {
        const updated = [...prev];
        if (field === "label") {
          updated[index] = { ...updated[index], label: value };
        } else if (field === "spendThreshold") {
          updated[index] = {
            ...updated[index],
            spendThreshold: parseFloat(value) || 0,
          };
        } else if (field === "bonusAmount") {
          updated[index] = {
            ...updated[index],
            bonusAmount: parseFloat(value) || 0,
          };
        }
        return updated;
      });
    },
    [],
  );

  const addMilestone = useCallback(() => {
    setMilestones((prev) => {
      const lastThreshold = prev.length > 0 ? prev[prev.length - 1].spendThreshold : 0;
      return [
        ...prev,
        {
          spendThreshold: lastThreshold + 500,
          bonusAmount: 25,
          label: `${lastThreshold + 500} Club`,
        },
      ];
    });
  }, []);

  const removeMilestone = useCallback((index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set(
      "bonuses",
      JSON.stringify({
        referralEnabled,
        referralAmount: parseFloat(referralAmount) || 0,
        referralNewCustomerAmount: parseFloat(referralNewAmount) || 0,
        milestoneEnabled,
        milestones,
      }),
    );
    submit(formData, { method: "post" });
  }, [referralEnabled, referralAmount, referralNewAmount, milestoneEnabled, milestones, submit]);

  return (
    <Page
      title="Bonus Credits"
      backAction={{ url: "/app" }}
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner title="Bonus settings saved" tone="success" onDismiss={() => {}} />
        )}
        {actionData?.error && (
          <Banner title={actionData.error} tone="critical" />
        )}

        <Layout>
          {/* Referrals */}
          <Layout.AnnotatedSection
            title="Referral rewards"
            description="Reward customers who refer new shoppers. Both the referrer and the new customer receive store credit. Use Shopify Flow to trigger referral credits."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Enable referral rewards"
                  helpText="Configure these in Shopify Flow using the 'Add store credit' action."
                  checked={referralEnabled}
                  onChange={setReferralEnabled}
                />

                {referralEnabled && (
                  <>
                    <Divider />
                    <InlineGrid columns={2} gap="300">
                      <TextField
                        label={`Referrer reward (${settings.currencyCode})`}
                        type="number"
                        value={referralAmount}
                        onChange={setReferralAmount}
                        autoComplete="off"
                        min={0}
                        helpText="Credit for the existing customer who refers"
                      />
                      <TextField
                        label={`New customer reward (${settings.currencyCode})`}
                        type="number"
                        value={referralNewAmount}
                        onChange={setReferralNewAmount}
                        autoComplete="off"
                        min={0}
                        helpText="Credit for the referred new customer"
                      />
                    </InlineGrid>

                    <Banner tone="info">
                      <p>
                        <strong>Setup:</strong> Create a Shopify Flow that
                        triggers when a customer is referred (e.g., via a tag or
                        metafield). Use the "Add store credit" action from this
                        app with the amounts configured above.
                      </p>
                    </Banner>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* Milestones */}
          <Layout.AnnotatedSection
            title="Spending milestones"
            description="Award one-time bonus credits when customers reach cumulative spending milestones. This encourages long-term loyalty."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Enable milestone bonuses"
                  helpText="Customers get a one-time bonus credit when they reach each milestone."
                  checked={milestoneEnabled}
                  onChange={setMilestoneEnabled}
                />

                {milestoneEnabled && (
                  <>
                    <Divider />
                    <BlockStack gap="400">
                      {milestones.map((m, index) => (
                        <Card key={index}>
                          <BlockStack gap="200">
                            <InlineStack
                              align="space-between"
                              blockAlign="center"
                            >
                              <Badge tone="success">
                                +{settings.currencyCode} {m.bonusAmount} bonus
                              </Badge>
                              {milestones.length > 1 && (
                                <Button
                                  variant="plain"
                                  tone="critical"
                                  onClick={() => removeMilestone(index)}
                                >
                                  Remove
                                </Button>
                              )}
                            </InlineStack>
                            <InlineGrid columns={3} gap="300">
                              <TextField
                                label="Label"
                                value={m.label}
                                onChange={(val) =>
                                  handleMilestoneChange(index, "label", val)
                                }
                                autoComplete="off"
                              />
                              <TextField
                                label={`Spend threshold (${settings.currencyCode})`}
                                type="number"
                                value={m.spendThreshold.toString()}
                                onChange={(val) =>
                                  handleMilestoneChange(
                                    index,
                                    "spendThreshold",
                                    val,
                                  )
                                }
                                autoComplete="off"
                                min={0}
                              />
                              <TextField
                                label={`Bonus credit (${settings.currencyCode})`}
                                type="number"
                                value={m.bonusAmount.toString()}
                                onChange={(val) =>
                                  handleMilestoneChange(
                                    index,
                                    "bonusAmount",
                                    val,
                                  )
                                }
                                autoComplete="off"
                                min={0}
                              />
                            </InlineGrid>
                          </BlockStack>
                        </Card>
                      ))}

                      <InlineStack align="start">
                        <Button onClick={addMilestone}>Add milestone</Button>
                      </InlineStack>
                    </BlockStack>

                    <Banner tone="info">
                      <p>
                        Milestone bonuses are awarded automatically when a
                        customer's cumulative spending reaches the threshold.
                        Each milestone is awarded only once per customer.
                      </p>
                    </Banner>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
