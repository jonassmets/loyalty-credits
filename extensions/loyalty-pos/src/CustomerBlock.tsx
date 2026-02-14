import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<CustomerLoyaltyBlock />, document.body);
};

function CustomerLoyaltyBlock() {
  const [balance, setBalance] = useState("0.00");
  const [tier, setTier] = useState("Level 1");
  const [percentage, setPercentage] = useState("5%");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const customerId = shopify.customer.current.value?.id;
      if (!customerId) {
        setLoading(false);
        return;
      }

      const res = await fetch("shopify:admin/api/graphql.json", {
        method: "POST",
        body: JSON.stringify({
          query: `query GetCustomerLoyalty($id: ID!) {
            customer(id: $id) {
              totalEarned: metafield(namespace: "$app", key: "loyalty_total_earned") { value }
              totalSpent: metafield(namespace: "$app", key: "loyalty_total_spent_amount") { value }
              giftCardId: metafield(namespace: "$app", key: "loyalty_gift_card_id") { value }
            }
          }`,
          variables: { id: `gid://shopify/Customer/${customerId}` },
        }),
      });

      const data = await res.json();
      const customer = data?.data?.customer;

      if (customer) {
        const spent = parseFloat(customer.totalSpent?.value || "0");

        if (spent >= 1000) {
          setTier("Level 3");
          setPercentage("10%");
        } else if (spent >= 500) {
          setTier("Level 2");
          setPercentage("7.5%");
        } else {
          setTier("Level 1");
          setPercentage("5%");
        }

        if (customer.giftCardId?.value) {
          const gcRes = await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            body: JSON.stringify({
              query: `query GetGiftCardBalance($id: ID!) {
                giftCard(id: $id) {
                  balance { amount }
                }
              }`,
              variables: { id: customer.giftCardId.value },
            }),
          });
          const gcData = await gcRes.json();
          const amount = gcData?.data?.giftCard?.balance?.amount;
          if (amount) {
            setBalance(parseFloat(amount).toFixed(2));
          }
        }
      }
    } catch {
      // Silently fail - data will show defaults
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <s-section heading="Loyalty Credits">
        <s-text color="subdued">Loading...</s-text>
      </s-section>
    );
  }

  return (
    <s-section heading="Loyalty Credits">
      <s-stack direction="block" gap="small">
        <s-stack direction="inline" gap="large">
          <s-stack direction="block" gap="small">
            <s-text color="subdued">Balance</s-text>
            <s-text type="strong">{balance} EUR</s-text>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text color="subdued">Tier</s-text>
            <s-text type="strong">{tier}</s-text>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text color="subdued">Earning</s-text>
            <s-text type="strong">{percentage}</s-text>
          </s-stack>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
