import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import {
  Banner,
  BlockStack,
  Card,
  Checkbox,
  Divider,
  Layout,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../loyalty.server";
import { DEFAULT_SETTINGS, MONTH_OPTIONS } from "../loyalty.shared";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
    const settings = await getSettings(admin);
    return { settings };
  } catch (e) {
    console.error("[settings] Failed to load settings:", e);
    return { settings: DEFAULT_SETTINGS };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const settingsRaw = formData.get("settings");

  if (typeof settingsRaw !== "string") {
    return { success: false, error: "Invalid form data" };
  }

  try {
    const incoming = JSON.parse(settingsRaw);
    const currentSettings = await getSettings(admin);

    const updated = {
      ...currentSettings,
      enabled: incoming.enabled,
      yearlyReset: incoming.yearlyReset,
      resetMonth: incoming.resetMonth,
      currencyCode: incoming.currencyCode,
    };

    const result = await saveSettings(admin, updated);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: "Failed to save settings" };
  }
};

export default function Settings() {
  const { settings: saved } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSaving = navigation.state === "submitting";

  const [enabled, setEnabled] = useState(saved.enabled);
  const [yearlyReset, setYearlyReset] = useState(saved.yearlyReset);
  const [resetMonth, setResetMonth] = useState(saved.resetMonth.toString());
  const [currencyCode, setCurrencyCode] = useState(saved.currencyCode);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set(
      "settings",
      JSON.stringify({
        enabled,
        yearlyReset,
        resetMonth: parseInt(resetMonth, 10),
        currencyCode,
      }),
    );
    submit(formData, { method: "post" });
  }, [enabled, yearlyReset, resetMonth, currencyCode, submit]);

  const currencyOptions = [
    { label: "EUR (€) — Euro", value: "EUR" },
    { label: "USD ($) — US Dollar", value: "USD" },
    { label: "GBP (£) — British Pound", value: "GBP" },
    { label: "CAD (C$) — Canadian Dollar", value: "CAD" },
    { label: "AUD (A$) — Australian Dollar", value: "AUD" },
    { label: "CHF — Swiss Franc", value: "CHF" },
    { label: "SEK (kr) — Swedish Krona", value: "SEK" },
    { label: "NOK (kr) — Norwegian Krone", value: "NOK" },
    { label: "DKK (kr) — Danish Krone", value: "DKK" },
    { label: "PLN (zł) — Polish Zloty", value: "PLN" },
    { label: "CZK (Kč) — Czech Koruna", value: "CZK" },
    { label: "JPY (¥) — Japanese Yen", value: "JPY" },
    { label: "NZD (NZ$) — New Zealand Dollar", value: "NZD" },
  ];

  return (
    <Page
      title="Settings"
      backAction={{ url: "/app" }}
      primaryAction={{
        content: "Save settings",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner title="Settings saved" tone="success" onDismiss={() => {}} />
        )}
        {actionData?.error && (
          <Banner title={actionData.error} tone="critical" />
        )}

        <Layout>
          <Layout.AnnotatedSection
            title="Loyalty program"
            description="Control whether the loyalty program is active. When disabled, no store credit is awarded on new orders but existing balances remain."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Enable loyalty program"
                  helpText="Customers automatically earn store credit on every paid order when enabled."
                  checked={enabled}
                  onChange={setEnabled}
                />
                {!enabled && (
                  <Banner tone="warning">
                    <p>
                      The loyalty program is currently paused. No store credit
                      will be awarded on new orders. Existing customer balances
                      are not affected.
                    </p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Currency"
            description="The currency used for store credit. This should match your shop's primary currency for accurate calculations."
          >
            <Card>
              <BlockStack gap="300">
                <Select
                  label="Store credit currency"
                  options={currencyOptions}
                  value={currencyCode}
                  onChange={setCurrencyCode}
                  helpText="Store credit is always issued in this currency."
                />
                <Text variant="bodySm" as="p" tone="subdued">
                  If your shop uses multiple currencies, store credit is still
                  issued in this primary currency. Shopify automatically handles
                  conversion at checkout.
                </Text>
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Spending period"
            description="Configure whether customer spending totals reset periodically. This affects tier placement."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Reset spending totals yearly"
                  helpText="When enabled, customers restart from the lowest tier at the beginning of each period. Their existing store credit balance is not affected."
                  checked={yearlyReset}
                  onChange={setYearlyReset}
                />

                {yearlyReset && (
                  <>
                    <Select
                      label="Reset month"
                      options={MONTH_OPTIONS}
                      value={resetMonth}
                      onChange={setResetMonth}
                      helpText="Spending totals reset on the 1st of this month each year."
                    />
                    <Banner tone="info">
                      <p>
                        <strong>How yearly reset works:</strong> On the 1st of{" "}
                        {MONTH_OPTIONS.find((m) => m.value === resetMonth)?.label || "the chosen month"},{" "}
                        each customer's spending counter resets to zero. They
                        start earning from the lowest tier again. Any store
                        credit already in their account stays — only the tier
                        calculation resets.
                      </p>
                    </Banner>
                  </>
                )}

                {!yearlyReset && (
                  <Text variant="bodySm" as="p" tone="subdued">
                    Spending is tracked forever. Once a customer reaches a
                    higher tier, they keep it permanently. This is great for
                    long-term customer loyalty.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="How store credit works"
            description="Technical details about how the loyalty program integrates with Shopify."
          >
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  Native Shopify Store Credit
                </Text>
                <Text variant="bodyMd" as="p">
                  This app uses Shopify's built-in store credit system — no gift
                  cards or workarounds. Credits are added directly to customers'
                  accounts and appear at checkout automatically.
                </Text>
                <Divider />
                <Text variant="headingSm" as="h3">
                  When credit is awarded
                </Text>
                <Text variant="bodyMd" as="p">
                  Store credit is awarded when an order is marked as paid. The
                  app receives a webhook from Shopify, calculates the credit
                  based on the customer's tier, and adds it to their account
                  instantly.
                </Text>
                <Divider />
                <Text variant="headingSm" as="h3">
                  Where customers can use it
                </Text>
                <Text variant="bodyMd" as="p">
                  Store credit works everywhere — online checkout, Shop Pay,
                  POS terminals, and draft orders. Customers see their balance
                  in their account and at checkout.
                </Text>
                <Divider />
                <Text variant="headingSm" as="h3">
                  Tier calculation
                </Text>
                <Text variant="bodyMd" as="p">
                  The customer's tier is determined by their cumulative spending
                  {yearlyReset
                    ? " within the current period"
                    : " since they first purchased"}
                  . When they place an order, their spending is updated first,
                  then the appropriate tier percentage is applied to calculate
                  the credit.
                </Text>
                <Divider />
                <Text variant="headingSm" as="h3">
                  Manual credits
                </Text>
                <Text variant="bodyMd" as="p">
                  You can also add store credit manually from the Customers page.
                  This is useful for returns, complaints, promotions, or
                  referral rewards. Manual credits are logged separately in the
                  Activity page.
                </Text>
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
