import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<ProfileBlock />, document.body);
};

function ProfileBlock() {
  const i18n = shopify.i18n;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const customerId = shopify.customerAccount?.customerId;
        if (!customerId) {
          setLoading(false);
          return;
        }
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
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <s-section>
        <s-text color="subdued">Loading loyalty info...</s-text>
      </s-section>
    );
  }

  if (!data) {
    return (
      <s-section>
        <s-stack direction="block" gap="base">
          <s-text type="strong" color="subdued">LOYALTY PROGRAM</s-text>
          <s-text>Earn store credit on every purchase! The more you spend, the more you earn.</s-text>
        </s-stack>
      </s-section>
    );
  }

  const currency = data.currencyCode || "EUR";
  const balance = parseFloat(data.balance) || 0;
  const totalEarned = data.totalEarned || 0;
  const tier = data.tier || { name: "Member", creditPercentage: 0 };
  const nextTier = data.nextTier;

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" inline-alignment="space-between">
          <s-text type="strong" color="subdued">LOYALTY PROGRAM</s-text>
          <s-text type="strong" tone="success">{tier.name}</s-text>
        </s-stack>

        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="large">
          <s-stack direction="block" gap="small">
            <s-text color="subdued">Balance</s-text>
            <s-text type="strong">
              {i18n.formatCurrency(balance, { currency })}
            </s-text>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text color="subdued">Total earned</s-text>
            <s-text type="strong">
              {i18n.formatCurrency(totalEarned, { currency })}
            </s-text>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text color="subdued">Earning rate</s-text>
            <s-text type="strong">{tier.creditPercentage}%</s-text>
          </s-stack>
        </s-grid>

        {nextTier && nextTier.amountToReach > 0 && (
          <s-text color="subdued">
            Spend {i18n.formatCurrency(nextTier.amountToReach, { currency })}{" "}
            more to reach {nextTier.name} and earn {data.tiers?.find(t => t.name === nextTier.name)?.creditPercentage || "more"}% back.
          </s-text>
        )}

        {!nextTier && (
          <s-text tone="success">
            You're at the highest tier! Earning {tier.creditPercentage}% on every order.
          </s-text>
        )}
      </s-stack>
    </s-section>
  );
}
