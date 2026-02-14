// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  try {
    render(<RewardsPage />, document.body);
  } catch (e) {
    render(
      <s-banner tone="critical">
        <s-text>Extension error: {String(e)}</s-text>
      </s-banner>,
      document.body,
    );
  }
};

function RewardsPage() {
  const tiers = [
    {name: 'Bronze', range: '€0 – €5,000', pct: 5},
    {name: 'Silver', range: '€5,000 – €10,000', pct: 7},
    {name: 'Gold', range: '€10,000+', pct: 10},
  ];

  return (
    <s-page heading="My Rewards">
      <s-stack direction="block" gap="large">
        {/* Overview */}
        <s-section heading="Loyalty Program">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text>
              Earn store credit on every purchase! Your cashback percentage is
              based on how much you've spent in the last 12 months.
            </s-text>
            <s-banner tone="info">
              <s-text>
                Store credit is applied automatically at checkout — no codes
                needed.
              </s-text>
            </s-banner>
          </s-stack>
        </s-section>

        {/* Tiers */}
        <s-section heading="Spending Tiers">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text color="subdued">
              Your tier is based on total spending in the last 12 months.
            </s-text>

            {tiers.map((t) => (
              <s-stack key={t.name} direction="inline" inline-alignment="space-between" gap="base">
                <s-stack direction="block" gap="small">
                  <s-text type="strong">{t.name}</s-text>
                  <s-text color="subdued">{t.range} in 12 months</s-text>
                </s-stack>
                <s-text type="strong" tone="success">{t.pct}% cashback</s-text>
              </s-stack>
            ))}
          </s-stack>
        </s-section>

        {/* How it works */}
        <s-section heading="How it works">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text>1. Shop as usual — every order counts toward your tier.</s-text>
            <s-text>2. Your tier is determined by spending in the last 12 months.</s-text>
            <s-text>3. After each order, you receive your tier's percentage as store credit.</s-text>
            <s-text>4. Store credit is applied automatically at checkout.</s-text>
            <s-text>5. Stay active to keep your tier — spending resets on a rolling basis.</s-text>
          </s-stack>
        </s-section>

        {/* Example */}
        <s-section heading="Example">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text>
              You've spent €6,500 in the last 12 months — Silver tier.
            </s-text>
            <s-text>
              A €100 order earns you €7 in store credit (7% cashback).
            </s-text>
            <s-text color="subdued">
              Spend €3,500 more to reach Gold and get 10% back!
            </s-text>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
