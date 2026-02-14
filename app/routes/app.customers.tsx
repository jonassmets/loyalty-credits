import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Modal,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { addStoreCredit } from "../loyalty.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Get recent loyalty logs
  const logs = await prisma.loyaltyLog.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Get customer names for the logs
  const customerIds = [...new Set(logs.map((l) => l.customerId))];
  const customerNames: Record<string, string> = {};

  if (customerIds.length > 0) {
    for (const id of customerIds.slice(0, 10)) {
      try {
        const response = await admin.graphql(
          `#graphql
          query GetCustomerName($id: ID!) {
            customer(id: $id) {
              displayName
              email
            }
          }`,
          { variables: { id } },
        );
        const data = await response.json();
        const customer = data.data?.customer;
        customerNames[id] = customer?.displayName || customer?.email || id;
      } catch {
        customerNames[id] = id;
      }
    }
  }

  return {
    logs: logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
      customerName: customerNames[log.customerId] || log.customerId,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const customerId = formData.get("customerId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const note = formData.get("note") as string;

  if (!customerId || isNaN(amount) || amount <= 0) {
    return { success: false, error: "Invalid customer ID or amount" };
  }

  try {
    const result = await addStoreCredit(admin, customerId, amount, note);

    // Log the manual credit
    await prisma.loyaltyLog.create({
      data: {
        shop: session.shop,
        customerId,
        amount,
        type: "manual_credit",
        note: note || "Manual credit adjustment",
      },
    });

    return {
      success: true,
      error: null,
      message: `Added ${amount} EUR credit. New balance: ${result.newBalance} EUR`,
    };
  } catch (error) {
    return { success: false, error: "Failed to add store credit" };
  }
};

export default function Customers() {
  const { logs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleAddCredit = useCallback(() => {
    const formData = new FormData();
    formData.set("customerId", customerId);
    formData.set("amount", amount);
    formData.set("note", note);
    submit(formData, { method: "post" });
    setModalOpen(false);
    setCustomerId("");
    setAmount("");
    setNote("");
  }, [customerId, amount, note, submit]);

  const rows = logs.map((log: any) => [
    log.customerName,
    `${log.amount > 0 ? "+" : ""}${log.amount} EUR`,
    log.type.replace("_", " "),
    log.note || "-",
    new Date(log.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page
      title="Customer Loyalty"
      primaryAction={{
        content: "Add credit manually",
        onAction: () => setModalOpen(true),
      }}
    >
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner
            title={(actionData as any).message || "Credit added successfully"}
            tone="success"
            onDismiss={() => {}}
          />
        )}
        {actionData?.error && (
          <Banner title={actionData.error} tone="critical" />
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Recent Activity
                </Text>

                {rows.length > 0 ? (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "numeric",
                      "text",
                      "text",
                      "text",
                    ]}
                    headings={[
                      "Customer",
                      "Amount",
                      "Type",
                      "Note",
                      "Date",
                    ]}
                    rows={rows}
                  />
                ) : (
                  <Text as="p" tone="subdued">
                    No loyalty activity yet. Credits will appear here after
                    customers make purchases.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add store credit"
        primaryAction={{
          content: "Add credit",
          onAction: handleAddCredit,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Customer GID"
              value={customerId}
              onChange={setCustomerId}
              placeholder="gid://shopify/Customer/123456789"
              helpText="The Shopify customer global ID"
              autoComplete="off"
            />
            <TextField
              label="Amount (EUR)"
              type="number"
              value={amount}
              onChange={setAmount}
              placeholder="10.00"
              autoComplete="off"
            />
            <TextField
              label="Note (optional)"
              value={note}
              onChange={setNote}
              placeholder="Reason for credit"
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
