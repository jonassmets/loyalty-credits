import { useState, useCallback, useEffect, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useFetcher,
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
  ProgressBar,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { addStoreCredit, getSettings, getCustomerLoyaltyData } from "../loyalty.server";
import { getTierForSpend } from "../loyalty.shared";
import type { LoyaltySettings, LoyaltyTier } from "../loyalty.shared";
import prisma from "../db.server";

// ── Loader: handles search via ?q= ──────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  let settings: LoyaltySettings;
  try {
    settings = await getSettings(admin);
  } catch {
    settings = {
      tiers: [],
      currencyCode: "EUR",
      enabled: false,
      yearlyReset: false,
      resetMonth: 1,
    };
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
    nextTierName: string | null;
    nextTierMinSpend: number | null;
    spendProgress: number;
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
        { variables: { query: search, first: 20 } },
      );

      const data = await response.json();
      const nodes = data.data?.customers?.nodes || [];

      customers = await Promise.all(
        nodes.map(async (c: any) => {
          let loyaltyData = { totalSpent: 0, totalEarned: 0, periodSpent: 0, storeCreditBalance: null as string | null };
          try {
            loyaltyData = await getCustomerLoyaltyData(admin, c.id);
          } catch {}

          const spendForTier = settings.yearlyReset
            ? loyaltyData.periodSpent
            : loyaltyData.totalSpent;

          const sortedTiers = [...settings.tiers].sort(
            (a, b) => a.minSpend - b.minSpend,
          );
          const tier =
            sortedTiers.length > 0
              ? getTierForSpend(sortedTiers, spendForTier)
              : null;
          const tierIndex = tier
            ? sortedTiers.findIndex((t) => t.minSpend === tier.minSpend)
            : -1;
          const nextTier =
            tierIndex >= 0 && tierIndex < sortedTiers.length - 1
              ? sortedTiers[tierIndex + 1]
              : null;

          // Progress toward next tier
          let spendProgress = 100;
          if (nextTier && tier) {
            const range = nextTier.minSpend - tier.minSpend;
            const progress = spendForTier - tier.minSpend;
            spendProgress = range > 0 ? Math.min((progress / range) * 100, 100) : 100;
          }

          const creditBalance =
            c.storeCreditAccounts?.nodes?.[0]?.balance;

          return {
            id: c.id,
            name: c.displayName || "Unknown",
            email: c.defaultEmailAddress?.emailAddress || "",
            orders: c.numberOfOrders || "0",
            totalSpent: `${c.amountSpent?.currencyCode || settings.currencyCode} ${parseFloat(c.amountSpent?.amount || "0").toFixed(2)}`,
            storeCredit: creditBalance
              ? `${creditBalance.currencyCode} ${parseFloat(creditBalance.amount).toFixed(2)}`
              : "—",
            loyaltySpent: loyaltyData.totalSpent,
            loyaltyEarned: loyaltyData.totalEarned,
            tierName: tier?.name || "—",
            nextTierName: nextTier?.name || null,
            nextTierMinSpend: nextTier?.minSpend || null,
            spendProgress,
          };
        }),
      );
    } catch (e) {
      console.error("[customers] Search failed:", e);
    }
  }

  return { customers, search, settings };
};

// ── Action: manual credit ────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "add-credit") {
    const customerId = formData.get("customerId") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const note = (formData.get("note") as string) || "Manual credit";

    if (!customerId || isNaN(amount) || amount <= 0) {
      return { success: false, error: "Please enter a valid amount" };
    }

    try {
      const settings = await getSettings(admin);
      const result = await addStoreCredit(
        admin,
        customerId,
        amount,
        settings.currencyCode,
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to add credit",
        };
      }

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

// ── Component ────────────────────────────────────────────────────────

export default function Customers() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  // Live search with fetcher
  const fetcher = useFetcher<typeof loader>();
  const [searchValue, setSearchValue] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSearching = fetcher.state === "loading";

  // Use fetcher data if available, otherwise fall back to loader data
  const displayData = fetcher.data || loaderData;
  const { customers, settings } = displayData;

  // Debounced search - triggers after 300ms of no typing
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      if (value.length >= 2) {
        debounceTimer.current = setTimeout(() => {
          fetcher.load(`/app/customers?q=${encodeURIComponent(value)}`);
        }, 300);
      }
    },
    [fetcher],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Credit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");

  const openCreditModal = useCallback((id: string, name: string) => {
    setSelectedCustomer({ id, name });
    setCreditAmount("");
    setCreditNote("");
    setModalOpen(true);
  }, []);

  const handleAddCredit = useCallback(() => {
    if (!selectedCustomer) return;
    const formData = new FormData();
    formData.set("intent", "add-credit");
    formData.set("customerId", selectedCustomer.id);
    formData.set("amount", creditAmount);
    formData.set(
      "note",
      creditNote || `Manual credit for ${selectedCustomer.name}`,
    );
    submit(formData, { method: "post" });
    setModalOpen(false);
  }, [selectedCustomer, creditAmount, creditNote, submit]);

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

        {/* Search */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">
              Find a customer
            </Text>
            <TextField
              label="Search"
              labelHidden
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Start typing a name, email, or phone number..."
              autoComplete="off"
              prefix={isSearching ? <Spinner size="small" /> : undefined}
              helpText={
                searchValue.length > 0 && searchValue.length < 2
                  ? "Type at least 2 characters to search"
                  : undefined
              }
            />
          </BlockStack>
        </Card>

        {/* Results */}
        {searchValue.length >= 2 && customers.length > 0 && (
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              {customers.length} result{customers.length !== 1 ? "s" : ""}
            </Text>

            {customers.map((c: any) => (
              <Card key={c.id}>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="100">
                      <Text variant="headingSm" as="h3">
                        {c.name}
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {c.email}
                      </Text>
                    </BlockStack>
                    <InlineStack gap="200">
                      <Badge tone="info">{c.tierName}</Badge>
                      <Button
                        variant="plain"
                        onClick={() => openCreditModal(c.id, c.name)}
                      >
                        Add credit
                      </Button>
                    </InlineStack>
                  </InlineStack>

                  <Divider />

                  <InlineGrid columns={4} gap="400">
                    <BlockStack gap="050">
                      <Text variant="bodySm" as="p" tone="subdued">
                        Orders
                      </Text>
                      <Text variant="headingSm" as="p">
                        {c.orders}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text variant="bodySm" as="p" tone="subdued">
                        Total spent
                      </Text>
                      <Text variant="headingSm" as="p">
                        {c.totalSpent}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text variant="bodySm" as="p" tone="subdued">
                        Store credit
                      </Text>
                      <Text variant="headingSm" as="p">
                        {c.storeCredit}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text variant="bodySm" as="p" tone="subdued">
                        Credits earned
                      </Text>
                      <Text variant="headingSm" as="p">
                        {settings.currencyCode}{" "}
                        {c.loyaltyEarned.toFixed(2)}
                      </Text>
                    </BlockStack>
                  </InlineGrid>

                  {/* Next tier progress */}
                  {c.nextTierName && (
                    <>
                      <Divider />
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text variant="bodySm" as="p" tone="subdued">
                            Progress to {c.nextTierName}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {settings.currencyCode}{" "}
                            {Math.max(0, (c.nextTierMinSpend || 0) - c.loyaltySpent).toFixed(0)}{" "}
                            to go
                          </Text>
                        </InlineStack>
                        <ProgressBar
                          progress={c.spendProgress}
                          tone="primary"
                          size="small"
                        />
                      </BlockStack>
                    </>
                  )}

                  {!c.nextTierName && c.tierName !== "—" && (
                    <>
                      <Divider />
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone="success">Top tier</Badge>
                        <Text variant="bodySm" as="p" tone="subdued">
                          This customer is at the highest loyalty level
                        </Text>
                      </InlineStack>
                    </>
                  )}
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        )}

        {searchValue.length >= 2 && customers.length === 0 && !isSearching && (
          <Card>
            <EmptyState heading="No customers found" image="">
              <p>Try a different name, email, or phone number.</p>
            </EmptyState>
          </Card>
        )}

        {searchValue.length < 2 && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Customer Loyalty
                  </Text>
                  <Divider />
                  <Text variant="bodyMd" as="p">
                    Search for any customer to see their loyalty tier, spending
                    history, and store credit balance. You can also manually add
                    store credit for returns, promotions, or special rewards.
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info">Tier tracking</Badge>
                      <Text variant="bodyMd" as="p">
                        See which tier each customer is in and their progress to the next level
                      </Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="success">Manual credits</Badge>
                      <Text variant="bodyMd" as="p">
                        Add store credit for returns, complaints, referrals, or promotions
                      </Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge>Balance view</Badge>
                      <Text variant="bodyMd" as="p">
                        Check any customer's current store credit balance
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}
      </BlockStack>

      {/* Add Credit Modal */}
      {selectedCustomer && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Add store credit — ${selectedCustomer.name}`}
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
                  Credit is added via Shopify's native store credit. The
                  customer can use it immediately at checkout or POS.
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
                placeholder="e.g., Referral reward, Return credit, Birthday bonus"
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
