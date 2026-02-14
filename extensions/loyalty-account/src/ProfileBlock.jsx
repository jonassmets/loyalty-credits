// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  try {
    render(<ProfileBlock />, document.body);
  } catch (e) {
    render(
      <s-banner tone="critical">
        <s-text>Extension error: {String(e)}</s-text>
      </s-banner>,
      document.body,
    );
  }
};

function ProfileBlock() {
  const tiers = [
    {name: 'Bronze', range: '€0 – €5,000', pct: '5%'},
    {name: 'Silver', range: '€5,000 – €10,000', pct: '7%'},
    {name: 'Gold', range: '€10,000+', pct: '10%'},
  ];

  return (
    <s-section heading="Loyalty Rewards">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        <s-text>
          Earn store credit on every purchase. Your cashback tier is based
          on spending in the last 12 months.
        </s-text>

        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="large">
          {tiers.map((t) => (
            <s-stack key={t.name} direction="block" gap="small">
              <s-text type="strong">{t.name}</s-text>
              <s-text color="subdued">{t.range}</s-text>
              <s-text tone="success" type="strong">{t.pct} back</s-text>
            </s-stack>
          ))}
        </s-grid>

        <s-text color="subdued">
          Credit is applied automatically at checkout — no code needed.
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
