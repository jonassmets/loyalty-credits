import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<RewardsPage />, document.body);
};

function RewardsPage() {
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
      <s-page heading="My Rewards">
        <s-section>
          <s-text color="subdued">Loading your rewards...</s-text>
        </s-section>
      </s-page>
    );
  }

  if (!data || data.error) {
    return (
      <s-page heading="My Rewards">
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text type="strong">Loyalty Program</s-text>
            <s-text>
              Earn store credit on every purchase! The more you spend,
              the higher your tier and the more you earn back.
            </s-text>
            <s-text color="subdued">
              Your rewards will appear here once you make your first purchase.
            </s-text>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  const currency = data.currencyCode || "EUR";
  const balance = parseFloat(data.balance) || 0;
  const totalEarned = data.totalEarned || 0;
  const totalSpent = data.totalSpent || 0;
  const tier = data.tier || { name: "Member", creditPercentage: 0 };
  const nextTier = data.nextTier;
  const tiers = data.tiers || [];
  const activity = data.recentActivity || [];

  return (
    <s-page heading="My Rewards">
      <s-stack direction="block" gap="large">
        {/* Balance overview */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" inline-alignment="space-between">
              <s-text type="strong" color="subdued">STORE CREDIT</s-text>
              <s-text type="strong" tone="success">{tier.name}</s-text>
            </s-stack>

            <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="large">
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
                <s-text color="subdued">Total spent</s-text>
                <s-text type="strong">
                  {i18n.formatCurrency(totalSpent, { currency })}
                </s-text>
              </s-stack>
              <s-stack direction="block" gap="small">
                <s-text color="subdued">Earning rate</s-text>
                <s-text type="strong">{tier.creditPercentage}%</s-text>
              </s-stack>
            </s-grid>

            <s-text color="subdued">
              Your store credit is applied automatically at checkout. No code needed!
            </s-text>

            {nextTier && nextTier.amountToReach > 0 && (
              <s-banner tone="info">
                <s-text>
                  Spend {i18n.formatCurrency(nextTier.amountToReach, { currency })}{" "}
                  more to reach <s-text type="strong">{nextTier.name}</s-text> and
                  unlock a higher earning rate!
                </s-text>
              </s-banner>
            )}

            {!nextTier && (
              <s-banner tone="success">
                <s-text>
                  You're at the highest tier! You earn {tier.creditPercentage}% store
                  credit on every order.
                </s-text>
              </s-banner>
            )}
          </s-stack>
        </s-section>

        {/* Tier overview */}
        {tiers.length > 0 && (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text type="strong" color="subdued">LOYALTY TIERS</s-text>

              {tiers.map((t) => (
                <s-stack
                  key={t.name}
                  direction="inline"
                  inline-alignment="space-between"
                  gap="base"
                >
                  <s-stack direction="inline" gap="small">
                    <s-text type={t.isCurrent ? "strong" : "generic"}>
                      {t.isCurrent ? `▸ ${t.name}` : t.name}
                    </s-text>
                    {t.isCurrent && (
                      <s-text tone="success">(you)</s-text>
                    )}
                  </s-stack>
                  <s-stack direction="inline" gap="large">
                    <s-text color="subdued">
                      {i18n.formatCurrency(t.minSpend, { currency })} min
                    </s-text>
                    <s-text type="strong">{t.creditPercentage}% back</s-text>
                  </s-stack>
                </s-stack>
              ))}
            </s-stack>
          </s-section>
        )}

        {/* Recent activity */}
        {activity.length > 0 && (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text type="strong" color="subdued">RECENT ACTIVITY</s-text>

              {activity.map((item, idx) => (
                <s-stack
                  key={idx}
                  direction="inline"
                  inline-alignment="space-between"
                  gap="base"
                >
                  <s-stack direction="block" gap="small">
                    <s-text>{item.note}</s-text>
                    <s-text color="subdued">{item.date}</s-text>
                  </s-stack>
                  <s-text type="strong" tone="success">
                    +{i18n.formatCurrency(item.amount, { currency })}
                  </s-text>
                </s-stack>
              ))}
            </s-stack>
          </s-section>
        )}

        {/* How it works */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text type="strong" color="subdued">HOW IT WORKS</s-text>
            <s-text>1. Shop as usual — earn store credit on every purchase.</s-text>
            <s-text>2. The more you spend, the higher your tier and earning rate.</s-text>
            <s-text>3. Store credit is applied automatically at checkout.</s-text>
            <s-text>4. Works online, with Shop Pay, and at POS.</s-text>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
