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
  TextField,
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

    // Merge — only update the fields that come from this form
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
    { label: "EUR (€)", value: "EUR" },
    { label: "USD ($)", value: "USD" },
    { label: "GBP (£)", value: "GBP" },
    { label: "CAD (C$)", value: "CAD" },
    { label: "AUD (A$)", value: "AUD" },
    { label: "CHF (CHF)", value: "CHF" },
    { label: "SEK (kr)", value: "SEK" },
    { label: "NOK (kr)", value: "NOK" },
    { label: "DKK (kr)", value: "DKK" },
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
            title="Program status"
            description="Enable or disable the loyalty program. When disabled, no store credit is awarded on new orders."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Enable loyalty program"
                  helpText="When enabled, customers automatically earn store credit on every paid order."
                  checked={enabled}
                  onChange={setEnabled}
                />
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Currency"
            description="Set the currency for store credit. This should match your shop's primary currency."
          >
            <Card>
              <Select
                label="Store credit currency"
                options={currencyOptions}
                value={currencyCode}
                onChange={setCurrencyCode}
              />
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Yearly reset"
            description="When enabled, customer spending totals reset each year. This means customers restart from the lowest tier. Existing store credit balances are not affected."
          >
            <Card>
              <BlockStack gap="400">
                <Checkbox
                  label="Reset spending totals yearly"
                  helpText="Customers start fresh in the chosen month. Their store credit balance stays."
                  checked={yearlyReset}
                  onChange={setYearlyReset}
                />

                {yearlyReset && (
                  <Select
                    label="Reset month"
                    options={MONTH_OPTIONS}
                    value={resetMonth}
                    onChange={setResetMonth}
                    helpText="Spending totals reset on the 1st of this month."
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
