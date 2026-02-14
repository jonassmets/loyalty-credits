import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  DataTable,
  Divider,
  EmptyState,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getSettings } from "../loyalty.server";
import prisma from "../db.server";

const PAGE_SIZE = 50;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const typeFilter = url.searchParams.get("type") || "all";
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  let settings;
  try {
    settings = await getSettings(admin);
  } catch {
    settings = { currencyCode: "EUR", tiers: [], enabled: false, yearlyReset: false, resetMonth: 1 };
  }

  const where: any = { shop: session.shop };
  if (typeFilter !== "all") {
    where.type = typeFilter;
  }

  const [logs, totalCount] = await Promise.all([
    prisma.loyaltyLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.loyaltyLog.count({ where }),
  ]);

  // Get customer names for the logs
  const customerIds = [...new Set(logs.map((l) => l.customerId))];
  const customerNames: Record<string, string> = {};

  for (const id of customerIds.slice(0, 25)) {
    try {
      const response = await admin.graphql(
        `#graphql
        query GetCustomerName($id: ID!) {
          customer(id: $id) {
            displayName
          }
        }`,
        { variables: { id } },
      );
      const data = await response.json();
      customerNames[id] = data.data?.customer?.displayName || id.split("/").pop() || id;
    } catch {
      customerNames[id] = id.split("/").pop() || id;
    }
  }

  // Aggregate stats
  const [totalStats, typeBreakdown] = await Promise.all([
    prisma.loyaltyLog.aggregate({
      where: { shop: session.shop },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.loyaltyLog.groupBy({
      by: ["type"],
      where: { shop: session.shop },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
      customerName: customerNames[log.customerId] || log.customerId.split("/").pop() || log.customerId,
    })),
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    typeFilter,
    settings,
    stats: {
      totalAmount: totalStats._sum.amount || 0,
      totalCount: totalStats._count,
      byType: typeBreakdown.map((t) => ({
        type: t.type,
        amount: t._sum.amount || 0,
        count: t._count,
      })),
    },
  };
};

function formatType(type: string): string {
  const map: Record<string, string> = {
    purchase_credit: "Purchase",
    manual_credit: "Manual",
    flow_credit: "Flow",
    referral_credit: "Referral",
    birthday_credit: "Birthday",
    redemption: "Redemption",
  };
  return map[type] || type.replace(/_/g, " ");
}

function typeTone(type: string): "success" | "info" | "warning" | "attention" | undefined {
  if (type === "purchase_credit") return "success";
  if (type === "manual_credit") return "info";
  if (type === "redemption") return "warning";
  return "info";
}

export default function Activity() {
  const { logs, totalCount, page, totalPages, typeFilter, settings, stats } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleTypeFilter = (value: string) => {
    setSearchParams({ type: value, page: "1" });
  };

  const goToPage = (p: number) => {
    setSearchParams({ type: typeFilter, page: p.toString() });
  };

  const rows = logs.map((log: any) => [
    log.customerName,
    <Badge key={log.id} tone={typeTone(log.type)}>
      {formatType(log.type)}
    </Badge>,
    `+${settings.currencyCode} ${log.amount.toFixed(2)}`,
    log.note || "—",
    new Date(log.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  ]);

  const typeOptions = [
    { label: "All types", value: "all" },
    { label: "Purchase credits", value: "purchase_credit" },
    { label: "Manual credits", value: "manual_credit" },
    { label: "Flow credits", value: "flow_credit" },
    { label: "Referral credits", value: "referral_credit" },
    { label: "Birthday credits", value: "birthday_credit" },
  ];

  return (
    <Page title="Activity Log" subtitle={`${totalCount} total transactions`}>
      <BlockStack gap="500">
        {/* Stats */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Credit Breakdown
                </Text>
                <Divider />
                {stats.byType.length > 0 ? (
                  <InlineStack gap="400" wrap>
                    {stats.byType.map((t: any) => (
                      <Card key={t.type}>
                        <BlockStack gap="100">
                          <Badge tone={typeTone(t.type)}>
                            {formatType(t.type)}
                          </Badge>
                          <Text variant="headingSm" as="p">
                            {settings.currencyCode} {t.amount.toFixed(2)}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {t.count} transactions
                          </Text>
                        </BlockStack>
                      </Card>
                    ))}
                  </InlineStack>
                ) : (
                  <Text variant="bodyMd" as="p" tone="subdued">
                    No transactions recorded yet.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Filter + table */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="end">
                  <Text variant="headingMd" as="h2">
                    Transaction History
                  </Text>
                  <div style={{ width: "200px" }}>
                    <Select
                      label="Filter"
                      labelHidden
                      options={typeOptions}
                      value={typeFilter}
                      onChange={handleTypeFilter}
                    />
                  </div>
                </InlineStack>

                {rows.length > 0 ? (
                  <>
                    <DataTable
                      columnContentTypes={[
                        "text",
                        "text",
                        "numeric",
                        "text",
                        "text",
                      ]}
                      headings={["Customer", "Type", "Amount", "Note", "Date"]}
                      rows={rows}
                    />

                    {totalPages > 1 && (
                      <InlineStack align="center" gap="300">
                        <Button
                          disabled={page <= 1}
                          onClick={() => goToPage(page - 1)}
                        >
                          Previous
                        </Button>
                        <Text variant="bodySm" as="span">
                          Page {page} of {totalPages}
                        </Text>
                        <Button
                          disabled={page >= totalPages}
                          onClick={() => goToPage(page + 1)}
                        >
                          Next
                        </Button>
                      </InlineStack>
                    )}
                  </>
                ) : (
                  <EmptyState heading="No activity yet" image="">
                    <p>
                      Credits will appear here when customers make purchases or
                      you add manual credits. Make sure the loyalty program is
                      enabled in Settings and you have configured your tiers.
                    </p>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
