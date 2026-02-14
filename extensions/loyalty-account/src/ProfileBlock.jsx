// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(<ProfileBlock />, document.body);
};

function ProfileBlock() {
  const i18n = shopify.i18n;

  const tiers = [
    {name: 'Bronze', minSpend: 0, maxLabel: '5,000', percentage: 5},
    {name: 'Silver', minSpend: 5000, maxLabel: '10,000', percentage: 7},
    {name: 'Gold', minSpend: 10000, maxLabel: null, percentage: 10},
  ];

  return (
    <s-section heading="Loyalty Rewards">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="large">
          {tiers.map((t) => (
            <s-stack key={t.name} direction="block" gap="small">
              <s-text type="strong">{t.name}</s-text>
              <s-text color="subdued">
                {t.maxLabel
                  ? `${i18n.formatCurrency(t.minSpend, {currency: 'EUR'})} – ${i18n.formatCurrency(parseInt(t.maxLabel.replace(/,/g, '')), {currency: 'EUR'})}`
                  : `${i18n.formatCurrency(t.minSpend, {currency: 'EUR'})}+`}
              </s-text>
              <s-text tone="success" type="strong">
                {t.percentage}% back
              </s-text>
            </s-stack>
          ))}
        </s-grid>

        <s-text color="subdued">
          Earn store credit on every purchase based on your 12-month spending.
          Credit is applied automatically at checkout.
        </s-text>

        <s-stack direction="block" max-inline-size="160">
          <s-button tone="neutral" variant="secondary" href="extension:loyalty-rewards-page/">
            View rewards
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
