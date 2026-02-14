import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<RewardsPage />, document.body);
};

function RewardsPage() {
  const i18n = shopify.i18n;

  // TODO: Replace with real data from app backend via authenticated fetch
  const balance = 76.0;
  const totalEarned = 142.5;
  const totalSpent = 890.0;
  const creditPercentage = 5;

  const tiers = [
    { name: "Level 1", minSpent: 0, percentage: 5, current: totalSpent >= 0 && totalSpent < 500 },
    { name: "Level 2", minSpent: 500, percentage: 7.5, current: totalSpent >= 500 && totalSpent < 1000 },
    { name: "Level 3", minSpent: 1000, percentage: 10, current: totalSpent >= 1000 },
  ];

  const recentActivity = [
    { date: "2026-02-10", description: "Order #1042 - 5% credit", amount: 12.5 },
    { date: "2026-01-28", description: "Order #1038 - 5% credit", amount: 8.75 },
    { date: "2026-01-15", description: "Review bonus via Flow", amount: 5.0 },
    { date: "2026-01-02", description: "Order #1025 - 5% credit", amount: 15.25 },
  ];

  return (
    <s-page heading="My Rewards">
      <s-stack direction="block" gap="large">
        {/* Balance Card */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" inline-alignment="space-between">
              <s-text type="strong" color="subdued">
                STORE CREDIT BALANCE
              </s-text>
              <s-text type="strong" tone="success">
                {tiers.find((t) => t.current)?.name || "Level 1"}
              </s-text>
            </s-stack>

            <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="large">
              <s-stack direction="block" gap="small">
                <s-text color="subdued">Balance</s-text>
                <s-text type="strong">
                  {i18n.formatCurrency(balance, { currency: "EUR" })}
                </s-text>
              </s-stack>

              <s-stack direction="block" gap="small">
                <s-text color="subdued">Total earned</s-text>
                <s-text type="strong">
                  {i18n.formatCurrency(totalEarned, { currency: "EUR" })}
                </s-text>
              </s-stack>

              <s-stack direction="block" gap="small">
                <s-text color="subdued">Total spent</s-text>
                <s-text type="strong">
                  {i18n.formatCurrency(totalSpent, { currency: "EUR" })}
                </s-text>
              </s-stack>

              <s-stack direction="block" gap="small">
                <s-text color="subdued">Earning rate</s-text>
                <s-text type="strong">{creditPercentage}%</s-text>
              </s-stack>
            </s-grid>

            <s-text color="subdued">
              Your store credit is automatically applied as a gift card at
              checkout. No code needed!
            </s-text>
          </s-stack>
        </s-section>

        {/* Tier Progress */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text type="strong" color="subdued">
              LOYALTY TIERS
            </s-text>

            {tiers.map((t) => (
              <s-stack
                key={t.name}
                direction="inline"
                inline-alignment="space-between"
                gap="base"
              >
                <s-stack direction="inline" gap="small">
                  <s-text type={t.current ? "strong" : "generic"}>
                    {t.current ? `> ${t.name}` : t.name}
                  </s-text>
                  {t.current && (
                    <s-text tone="success">(current)</s-text>
                  )}
                </s-stack>
                <s-stack direction="inline" gap="large">
                  <s-text color="subdued">
                    {i18n.formatCurrency(t.minSpent, { currency: "EUR" })} min
                  </s-text>
                  <s-text type="strong">{t.percentage}% back</s-text>
                </s-stack>
              </s-stack>
            ))}
          </s-stack>
        </s-section>

        {/* Recent Activity */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text type="strong" color="subdued">
              RECENT ACTIVITY
            </s-text>

            {recentActivity.map((activity, idx) => (
              <s-stack
                key={idx}
                direction="inline"
                inline-alignment="space-between"
                gap="base"
              >
                <s-stack direction="block" gap="small">
                  <s-text>{activity.description}</s-text>
                  <s-text color="subdued">{activity.date}</s-text>
                </s-stack>
                <s-text type="strong" tone="success">
                  +{i18n.formatCurrency(activity.amount, { currency: "EUR" })}
                </s-text>
              </s-stack>
            ))}
          </s-stack>
        </s-section>

        {/* How it works */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text type="strong" color="subdued">
              HOW IT WORKS
            </s-text>
            <s-text>
              1. Shop as usual and earn store credit on every purchase.
            </s-text>
            <s-text>
              2. The more you spend, the higher your tier and earning rate.
            </s-text>
            <s-text>
              3. Your credit is stored as a gift card and applied automatically
              at checkout.
            </s-text>
            <s-text>
              4. Earn bonus credit through reviews, referrals, and special
              promotions.
            </s-text>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
