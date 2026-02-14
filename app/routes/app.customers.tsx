import { useState, useCallback, useEffect, useRef } from "react";
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
import { addStoreCredit, getSettings } from "../loyalty.server";
import { getTierForSpend } from "../loyalty.shared";
import type { LoyaltySettings } from "../loyalty.shared";
import prisma from "../db.server";

// ── Loader ───────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  let settings: LoyaltySettings;
  try {
    settings = await getSettings(admin);
  } catch {
    const shared = await import("../loyalty.shared");
    settings = shared.DEFAULT_SETTINGS;
  }

  let customers: Array<{
    id: string;
    name: string;
    email: string;
    orders: string;
    totalSpent: number;
    totalSpentFormatted: string;
    tierName: string;
    tierPercentage: number;
    nextTierName: string | null;
    nextTierMinSpend: number | null;
    spendProgress: number;
  }> = [];
  let searchError: string | null = null;

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
            }
          }
        }`,
        { variables: { query: search, first: 20 } },
      );

      const data = await response.json();
      const nodes = data.data?.customers?.nodes || [];

      const sortedTiers = [...settings.tiers].sort(
        (a, b) => a.minSpend - b.minSpend,
      );

      customers = nodes.map((c: any) => {
        const totalSpent = parseFloat(c.amountSpent?.amount || "0");

        // Estimate tier from amountSpent (best available without slow API calls)
        const tier =
          sortedTiers.length > 0
            ? getTierForSpend(sortedTiers, totalSpent)
            : null;
        const tierIndex = tier
          ? sortedTiers.findIndex((t) => t.minSpend === tier.minSpend)
          : -1;
        const nextTier =
          tierIndex >= 0 && tierIndex < sortedTiers.length - 1
            ? sortedTiers[tierIndex + 1]
            : null;

        let spendProgress = 100;
        if (nextTier && tier) {
          const range = nextTier.minSpend - tier.minSpend;
          const progress = totalSpent - tier.minSpend;
          spendProgress =
            range > 0 ? Math.min((progress / range) * 100, 100) : 100;
        }

        return {
          id: c.id,
          name: c.displayName || "Unknown",
          email: c.defaultEmailAddress?.emailAddress || "",
          orders: c.numberOfOrders || "0",
          totalSpent,
          totalSpentFormatted: `${c.amountSpent?.currencyCode || settings.currencyCode} ${totalSpent.toFixed(2)}`,
          tierName: tier?.name || "—",
          tierPercentage: tier?.creditPercentage || 0,
          nextTierName: nextTier?.name || null,
          nextTierMinSpend: nextTier?.minSpend || null,
          spendProgress,
        };
      });
    } catch (e: any) {
      console.error("[customers] Search failed:", e);
      searchError = e?.message || "Search failed";
    }
  }

  return { customers, search, settings, searchError };
};

// ── Action ───────────────────────────────────────────────────────────

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
  const { customers, search, settings, searchError } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

  const isSearching = navigation.state === "loading";
  const [searchValue, setSearchValue] = useState(search);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search via URL params
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      if (value.length >= 2) {
        debounceTimer.current = setTimeout(() => {
          setSearchParams({ q: value });
        }, 400);
      } else if (value.length === 0) {
        setSearchParams({});
      }
    },
    [setSearchParams],
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Credit modal
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

  const hasSearch = search.length >= 2;

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
        {searchError && (
          <Banner title={`Search error: ${searchError}`} tone="critical" />
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
              suffix={
                isSearching && hasSearch ? (
                  <Spinner size="small" />
                ) : undefined
              }
              helpText={
                searchValue.length > 0 && searchValue.length < 2
                  ? "Type at least 2 characters to search"
                  : undefined
              }
            />
          </BlockStack>
        </Card>

        {/* Results */}
        {hasSearch && customers.length > 0 && (
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
                      <Text variant="bodySm" as="span" tone="subdued">
                        {c.tierPercentage}% cashback
                      </Text>
                      <Button
                        variant="plain"
                        onClick={() => openCreditModal(c.id, c.name)}
                      >
                        Add credit
                      </Button>
                    </InlineStack>
                  </InlineStack>

                  <Divider />

                  <InlineGrid columns={3} gap="400">
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
                        {c.totalSpentFormatted}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text variant="bodySm" as="p" tone="subdued">
                        Est. cashback on €100 order
                      </Text>
                      <Text variant="headingSm" as="p">
                        {settings.currencyCode}{" "}
                        {c.tierPercentage.toFixed(2)}
                      </Text>
                    </BlockStack>
                  </InlineGrid>

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
                            {Math.max(
                              0,
                              (c.nextTierMinSpend || 0) - c.totalSpent,
                            ).toFixed(0)}{" "}
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
                          Highest cashback level
                        </Text>
                      </InlineStack>
                    </>
                  )}
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        )}

        {hasSearch &&
          customers.length === 0 &&
          !isSearching &&
          !searchError && (
            <Card>
              <EmptyState heading="No customers found" image="">
                <p>Try a different name, email, or phone number.</p>
              </EmptyState>
            </Card>
          )}

        {!hasSearch && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Customer Loyalty
              </Text>
              <Divider />
              <Text variant="bodyMd" as="p">
                Search for any customer to see their estimated loyalty tier,
                spending history, and progress. You can also manually add store
                credit.
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Tier is estimated from total spending. The actual tier at credit
                time is calculated from orders in the last 12 months.
              </Text>
            </BlockStack>
          </Card>
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
                placeholder="e.g., Referral reward, Return credit"
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
