import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useSearchParams,
} from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  DataTable,
  Divider,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Modal,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { addStoreCredit, getSettings, getCustomerLoyaltyData } from "../loyalty.server";
import { getTierForSpend } from "../loyalty.shared";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  let settings;
  try {
    settings = await getSettings(admin);
  } catch {
    settings = { tiers: [], currencyCode: "EUR", enabled: false, yearlyReset: false, resetMonth: 1 };
  }

  let customers: Array<{
    id: string;
    name: string;
    email: string;
    orders: string;
    totalSpent: string;
    storeCredit: string;
    loyaltySpent: number;
    loyaltyEarned: number;
    tierName: string;
  }> = [];

  if (search.length >= 2) {
    try {
      const response = await admin.graphql(
        `#graphql
        query SearchCustomers($query: String!, $first: Int!) {
          customers(first: $first, query: $query) {
            nodes {
              id
              displayName
              defaultEmailAddress {
                emailAddress
              }
              numberOfOrders
              amountSpent {
                amount
                currencyCode
              }
              storeCreditAccounts(first: 1) {
                nodes {
                  balance {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }`,
        { variables: { query: search, first: 25 } },
      );

      const data = await response.json();
      const nodes = data.data?.customers?.nodes || [];

      customers = await Promise.all(
        nodes.map(async (c: any) => {
          let loyaltyData = { totalSpent: 0, totalEarned: 0, periodSpent: 0 };
          try {
            loyaltyData = await getCustomerLoyaltyData(admin, c.id);
          } catch {}

          const spendForTier = settings.yearlyReset
            ? loyaltyData.periodSpent
            : loyaltyData.totalSpent;
          const tier = settings.tiers.length > 0
            ? getTierForSpend(settings.tiers, spendForTier)
            : null;

          return {
            id: c.id,
            name: c.displayName || "Unknown",
            email: c.defaultEmailAddress?.emailAddress || "",
            orders: c.numberOfOrders || "0",
            totalSpent: `${c.amountSpent?.currencyCode || settings.currencyCode} ${parseFloat(c.amountSpent?.amount || "0").toFixed(2)}`,
            storeCredit: c.storeCreditAccounts?.nodes?.[0]
              ? `${c.storeCreditAccounts.nodes[0].balance.currencyCode} ${parseFloat(c.storeCreditAccounts.nodes[0].balance.amount).toFixed(2)}`
              : "—",
            loyaltySpent: loyaltyData.totalSpent,
            loyaltyEarned: loyaltyData.totalEarned,
            tierName: tier?.name || "—",
          };
        }),
      );
    } catch (e) {
      console.error("[customers] Search failed:", e);
    }
  }

  // Also fetch customers with recent loyalty activity if no search
  let recentCustomerIds: string[] = [];
  if (!search) {
    try {
      const recentLogs = await prisma.loyaltyLog.groupBy({
        by: ["customerId"],
        where: { shop: session.shop },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
        take: 20,
      });
      recentCustomerIds = recentLogs.map((l) => l.customerId);
    } catch {}
  }

  return { customers, search, settings, recentCustomerIds };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");

  if (intent === "add-credit") {
    const customerId = formData.get("customerId") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const note = (formData.get("note") as string) || "Manual credit";

    if (!customerId || isNaN(amount) || amount <= 0) {
      return { success: false, error: "Please enter a valid customer ID and amount" };
    }

    try {
      const settings = await getSettings(admin);
      const result = await addStoreCredit(admin, customerId, amount, settings.currencyCode);

      if (!result.success) {
        return { success: false, error: result.error || "Failed to add credit" };
      }

      // Log the manual credit
      await prisma.loyaltyLog.create({
        data: {
          shop: session.shop,
          customerId,
          amount,
          type: "manual_credit",
          note,
        },
      });

      return {
        success: true,
        error: null,
        message: `Added ${settings.currencyCode} ${amount.toFixed(2)} store credit`,
      };
    } catch (error) {
      console.error("[customers] Manual credit failed:", error);
      return { success: false, error: "Failed to add store credit" };
    }
  }

  return { success: false, error: "Unknown action" };
};

export default function Customers() {
  const { customers, search, settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLoading = navigation.state !== "idle";

  const [searchValue, setSearchValue] = useState(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");

  const handleSearch = useCallback(() => {
    setSearchParams({ q: searchValue });
  }, [searchValue, setSearchParams]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch],
  );

  const openCreditModal = useCallback(
    (id: string, name: string) => {
      setSelectedCustomer({ id, name });
      setCreditAmount("");
      setCreditNote("");
      setModalOpen(true);
    },
    [],
  );

  const handleAddCredit = useCallback(() => {
    if (!selectedCustomer) return;
    const formData = new FormData();
    formData.set("intent", "add-credit");
    formData.set("customerId", selectedCustomer.id);
    formData.set("amount", creditAmount);
    formData.set("note", creditNote || `Manual credit for ${selectedCustomer.name}`);
    submit(formData, { method: "post" });
    setModalOpen(false);
  }, [selectedCustomer, creditAmount, creditNote, submit]);

  const rows = customers.map((c: any) => [
    c.name,
    c.email,
    c.orders,
    c.totalSpent,
    c.storeCredit,
    c.tierName,
    <Button
      key={c.id}
      variant="plain"
      onClick={() => openCreditModal(c.id, c.name)}
    >
      Add credit
    </Button>,
  ]);

  return (
    <Page title="Customers">
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner
            title={(actionData as any).message || "Done"}
            tone="success"
            onDismiss={() => {}}
          />
        )}
        {actionData?.error && (
          <Banner title={actionData.error} tone="critical" />
        )}

        <Layout>
          <Layout.Section>
            {/* Search */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Find a customer
                </Text>
                <InlineStack gap="300" blockAlign="end">
                  <Box minWidth="400px">
                    <TextField
                      label="Search"
                      labelHidden
                      value={searchValue}
                      onChange={setSearchValue}
                      placeholder="Search by name, email, or phone..."
                      autoComplete="off"
                      onKeyDown={handleKeyDown as any}
                    />
                  </Box>
                  <Button onClick={handleSearch} loading={isLoading && !!search}>
                    Search
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            {/* Results */}
            {search && customers.length > 0 && (
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Results for "{search}"
                  </Text>
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "text",
                      "numeric",
                      "text",
                      "text",
                      "text",
                      "text",
                    ]}
                    headings={[
                      "Name",
                      "Email",
                      "Orders",
                      "Total Spent",
                      "Store Credit",
                      "Tier",
                      "",
                    ]}
                    rows={rows}
                  />
                </BlockStack>
              </Card>
            )}

            {search && customers.length === 0 && !isLoading && (
              <Card>
                <EmptyState
                  heading="No customers found"
                  image=""
                >
                  <p>Try a different search term.</p>
                </EmptyState>
              </Card>
            )}

            {!search && (
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Customer Loyalty Overview
                  </Text>
                  <Divider />
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Search for a customer above to view their loyalty data, tier
                    status, and store credit balance. You can also manually add
                    store credit to any customer.
                  </Text>

                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">
                      What you can do here:
                    </Text>
                    <Text as="p" variant="bodyMd">
                      - Search customers by name, email, or phone number
                    </Text>
                    <Text as="p" variant="bodyMd">
                      - See each customer's current spending tier
                    </Text>
                    <Text as="p" variant="bodyMd">
                      - View their store credit balance
                    </Text>
                    <Text as="p" variant="bodyMd">
                      - Manually add store credit (e.g., for returns, complaints, promotions)
                    </Text>
                    <Text as="p" variant="bodyMd">
                      - Track total orders and spending
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Add Credit Modal */}
      {selectedCustomer && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Add store credit for ${selectedCustomer.name}`}
          primaryAction={{
            content: "Add credit",
            onAction: handleAddCredit,
            loading: navigation.state === "submitting",
            disabled: !creditAmount || parseFloat(creditAmount) <= 0,
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setModalOpen(false) },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Banner tone="info">
                <p>
                  This will add store credit directly to the customer's account
                  using Shopify's native store credit system. The credit will be
                  available at their next checkout.
                </p>
              </Banner>
              <TextField
                label={`Amount (${settings.currencyCode})`}
                type="number"
                value={creditAmount}
                onChange={setCreditAmount}
                placeholder="10.00"
                autoComplete="off"
                min={0.01}
                step={0.01}
              />
              <TextField
                label="Note (optional)"
                value={creditNote}
                onChange={setCreditNote}
                placeholder="Reason for credit (e.g., return, promotion, goodwill)"
                autoComplete="off"
                multiline={2}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
