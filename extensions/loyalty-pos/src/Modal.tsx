import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<LoyaltyModal />, document.body);
};

function LoyaltyModal() {
  const [customerName, setCustomerName] = useState("No customer");
  const [balance, setBalance] = useState("0.00");
  const [totalEarned, setTotalEarned] = useState("0.00");
  const [totalSpent, setTotalSpent] = useState("0.00");
  const [tier, setTier] = useState("Level 1");
  const [percentage, setPercentage] = useState("5%");
  const [hasCustomer, setHasCustomer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerData();
  }, []);

  async function loadCustomerData() {
    setLoading(true);
    try {
      const cart = shopify.cart.current.value;
      if (!cart.customer?.id) {
        setHasCustomer(false);
        setLoading(false);
        return;
      }

      const customerId = `gid://shopify/Customer/${cart.customer.id}`;
      const res = await fetch("shopify:admin/api/graphql.json", {
        method: "POST",
        body: JSON.stringify({
          query: `query GetCustomerLoyaltyFull($id: ID!) {
            customer(id: $id) {
              displayName
              email
              totalEarned: metafield(namespace: "$app", key: "loyalty_total_earned") { value }
              totalSpent: metafield(namespace: "$app", key: "loyalty_total_spent_amount") { value }
              giftCardId: metafield(namespace: "$app", key: "loyalty_gift_card_id") { value }
            }
          }`,
          variables: { id: customerId },
        }),
      });

      const data = await res.json();
      const customer = data?.data?.customer;

      if (customer) {
        setHasCustomer(true);
        setCustomerName(customer.displayName || customer.email || "Customer");
        const earned = parseFloat(customer.totalEarned?.value || "0");
        const spent = parseFloat(customer.totalSpent?.value || "0");
        setTotalEarned(earned.toFixed(2));
        setTotalSpent(spent.toFixed(2));

        // Determine tier
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

        // Get gift card balance if exists
        if (customer.giftCardId?.value) {
          const gcRes = await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            body: JSON.stringify({
              query: `query GetGiftCardBalance($id: ID!) {
                giftCard(id: $id) {
                  balance { amount currencyCode }
                }
              }`,
              variables: { id: customer.giftCardId.value },
            }),
          });
          const gcData = await gcRes.json();
          const gcBalance = gcData?.data?.giftCard?.balance?.amount;
          if (gcBalance) {
            setBalance(parseFloat(gcBalance).toFixed(2));
          }
        }
      }
    } catch (error) {
      shopify.toast.show("Failed to load loyalty data");
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <s-page heading="Loyalty Credits">
        <s-scroll-box>
          <s-section>
            <s-text>Loading customer loyalty data...</s-text>
          </s-section>
        </s-scroll-box>
      </s-page>
    );
  }

  if (!hasCustomer) {
    return (
      <s-page heading="Loyalty Credits">
        <s-scroll-box>
          <s-banner heading="No customer selected">
            <s-button
              slot="primary-action"
              onClick={() => navigation.back()}
            >
              Go back
            </s-button>
          </s-banner>
          <s-section>
            <s-text>
              Add a customer to the cart to view their loyalty information.
            </s-text>
          </s-section>
        </s-scroll-box>
      </s-page>
    );
  }

  return (
    <s-page heading="Loyalty Credits">
      <s-scroll-box>
        <s-section heading={customerName}>
          <s-stack direction="block" gap="base">
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

        <s-section heading="Details">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="large">
              <s-stack direction="block" gap="small">
                <s-text color="subdued">Total earned</s-text>
                <s-text>{totalEarned} EUR</s-text>
              </s-stack>
              <s-stack direction="block" gap="small">
                <s-text color="subdued">Total spent</s-text>
                <s-text>{totalSpent} EUR</s-text>
              </s-stack>
            </s-stack>

            <s-text color="subdued">
              Store credit is applied automatically via gift card at checkout.
            </s-text>
          </s-stack>
        </s-section>

        <s-section heading="Tier Progress">
          <s-stack direction="block" gap="small">
            <s-stack direction="inline" gap="large">
              <s-text type="strong">Level 1</s-text>
              <s-text>0 EUR - 5%</s-text>
            </s-stack>
            <s-stack direction="inline" gap="large">
              <s-text type="strong">Level 2</s-text>
              <s-text>500 EUR - 7.5%</s-text>
            </s-stack>
            <s-stack direction="inline" gap="large">
              <s-text type="strong">Level 3</s-text>
              <s-text>1000 EUR - 10%</s-text>
            </s-stack>
          </s-stack>
        </s-section>
      </s-scroll-box>
    </s-page>
  );
}
