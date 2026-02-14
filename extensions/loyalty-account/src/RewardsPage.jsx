// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(<RewardsPage />, document.body);
};

function RewardsPage() {
  const i18n = shopify.i18n;

  const tiers = [
    {name: 'Bronze', minSpend: 0, maxSpend: 5000, percentage: 5},
    {name: 'Silver', minSpend: 5000, maxSpend: 10000, percentage: 7},
    {name: 'Gold', minSpend: 10000, maxSpend: null, percentage: 10},
  ];

  return (
    <s-page heading="My Rewards">
      <s-stack direction="block" gap="large">
        {/* Overview */}
        <s-section heading="Loyalty Program">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text>
              Earn store credit on every purchase! Your cashback percentage is
              based on how much you've spent in the last 12 months. The more you
              shop, the more you earn back.
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
              Your tier is based on your total spending in the last 12 months.
            </s-text>

            {tiers.map((t) => (
              <s-stack key={t.name} direction="inline" inline-alignment="space-between" gap="base">
                <s-stack direction="block" gap="small">
                  <s-text type="strong">{t.name}</s-text>
                  <s-text color="subdued">
                    {t.maxSpend
                      ? `${i18n.formatCurrency(t.minSpend, {currency: 'EUR'})} – ${i18n.formatCurrency(t.maxSpend, {currency: 'EUR'})}`
                      : `${i18n.formatCurrency(t.minSpend, {currency: 'EUR'})}+`}
                    {' '}in 12 months
                  </s-text>
                </s-stack>
                <s-text type="strong" tone="success">
                  {t.percentage}% cashback
                </s-text>
              </s-stack>
            ))}
          </s-stack>
        </s-section>

        {/* How it works */}
        <s-section heading="How it works">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-stack direction="block" gap="small">
              <s-text>1. Shop as usual — every order counts toward your tier.</s-text>
              <s-text>2. Your tier is determined by spending in the last 12 months.</s-text>
              <s-text>3. After each order, you receive your tier's percentage as store credit.</s-text>
              <s-text>4. Store credit is applied automatically at checkout.</s-text>
              <s-text>5. Stay active to keep your tier — spending resets on a rolling basis.</s-text>
            </s-stack>
          </s-stack>
        </s-section>

        {/* Example */}
        <s-section heading="Example">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text>
              You've spent {i18n.formatCurrency(6500, {currency: 'EUR'})} in
              the last 12 months — you're in the Silver tier.
            </s-text>
            <s-text>
              Your next order of {i18n.formatCurrency(100, {currency: 'EUR'})}{' '}
              earns you {i18n.formatCurrency(7, {currency: 'EUR'})} in store
              credit (7% cashback).
            </s-text>
            <s-text color="subdued">
              Spend {i18n.formatCurrency(3500, {currency: 'EUR'})} more to
              reach Gold and get 10% back on every order!
            </s-text>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
