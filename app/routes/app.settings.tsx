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
import { DEFAULT_SETTINGS, CREDIT_EXPIRY_OPTIONS } from "../loyalty.shared";

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
      currencyCode: incoming.currencyCode,
      creditExpiry: incoming.creditExpiry,
      rollingWindow: true, // always rolling
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
  const [currencyCode, setCurrencyCode] = useState(saved.currencyCode);
  const [creditExpiry, setCreditExpiry] = useState(
    (saved as any).creditExpiry || "1_year",
  );

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set(
      "settings",
      JSON.stringify({ enabled, currencyCode, creditExpiry }),
    );
    submit(formData, { method: "post" });
  }, [enabled, currencyCode, creditExpiry, submit]);

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

  const expiryOptions = CREDIT_EXPIRY_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));

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
            description="The currency used for store credit. This should match your shop's primary currency."
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
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Tier calculation"
            description="How the app determines which tier a customer belongs to."
          >
            <Card>
              <BlockStack gap="400">
                <Banner tone="info">
                  <p>
                    <strong>Rolling 12-month window:</strong> A customer's tier
                    is always based on their spending in the last 12 months. This
                    is calculated from actual order dates — not a calendar reset.
                    If a customer doesn't purchase for a year, they naturally
                    drop to the lowest tier.
                  </p>
                </Banner>
                <Text variant="bodySm" as="p" tone="subdued">
                  Example: A customer who spent €7,000 between March 2025 and
                  February 2026 is in the Silver tier (7% cashback). If they
                  stop buying, their 12-month total decreases as old orders
                  fall outside the window.
                </Text>
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Store credit expiry"
            description="Choose how long store credit stays in a customer's account after being awarded."
          >
            <Card>
              <BlockStack gap="400">
                <Select
                  label="Credit expires after"
                  options={expiryOptions}
                  value={creditExpiry}
                  onChange={setCreditExpiry}
                  helpText="Expiry is set per credit transaction at the time of award."
                />
                {creditExpiry === "never" && (
                  <Text variant="bodySm" as="p" tone="subdued">
                    Store credit never expires. Once awarded, it stays in the
                    customer's account until they use it.
                  </Text>
                )}
                {creditExpiry !== "never" && (
                  <Banner tone="warning">
                    <p>
                      Each store credit award will have an expiry date. Shopify
                      automatically removes expired credits. Make sure your
                      customers know about the expiry policy.
                    </p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="How it works"
            description="Technical details about the loyalty program."
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
                  app receives a webhook from Shopify, looks at the customer's
                  orders in the last 12 months to determine their tier, then
                  awards that tier's percentage as store credit.
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
                  Manual credits
                </Text>
                <Text variant="bodyMd" as="p">
                  You can also add store credit manually from the Customers page.
                  Manual credits follow the same expiry setting configured above.
                </Text>
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
