import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<OrderStatusBlock />, document.body);
};

function OrderStatusBlock() {
  const i18n = shopify.i18n;
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const customerId = shopify.customerAccount?.customerId;
        if (!customerId) return;
        const token = await shopify.sessionToken.get();
        const res = await fetch(
          `/api/customer-loyalty?customerId=${encodeURIComponent(customerId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch (e) {
        console.error("Failed to load loyalty data:", e);
      }
    }
    fetchData();
  }, []);

  if (!data) return null;

  const currency = data.currencyCode || "EUR";
  const tier = data.tier || { name: "Member", creditPercentage: 0 };

  if (tier.creditPercentage <= 0) return null;

  return (
    <s-banner tone="success">
      <s-stack direction="block" inline-alignment="center">
        <s-text>
          You earned {tier.creditPercentage}% store credit on this order
          ({tier.name} tier). Your balance:{" "}
          {i18n.formatCurrency(parseFloat(data.balance) || 0, { currency })}.
        </s-text>
      </s-stack>
    </s-banner>
  );
}
