import { render } from "preact";

export default async () => {
  render(<ProfileBlock />, document.body);
};

function ProfileBlock() {
  const i18n = shopify.i18n;

  // TODO: Replace with real data from customer metafields via authenticated fetch
  const balance = 76.0;
  const totalEarned = 142.5;
  const totalSpent = 890.0;
  const tier = "Level 1";
  const creditPercentage = "5%";
  const nextTier = "Level 2";
  const amountToNextTier = 500 - totalSpent > 0 ? 500 - totalSpent : 0;

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" inline-alignment="space-between">
          <s-text type="strong" color="subdued">
            LOYALTY PROGRAM
          </s-text>
          <s-text type="strong" tone="success">
            {tier}
          </s-text>
        </s-stack>

        <s-grid
          gridTemplateColumns="1fr 1fr 1fr"
          gap="large"
        >
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
            <s-text color="subdued">Earning rate</s-text>
            <s-text type="strong">{creditPercentage}</s-text>
          </s-stack>
        </s-grid>

        {amountToNextTier > 0 && (
          <s-text color="subdued">
            Spend {i18n.formatCurrency(amountToNextTier, { currency: "EUR" })}{" "}
            more to reach {nextTier} and unlock higher rewards.
          </s-text>
        )}

        <s-stack direction="block" max-inline-size="140">
          <s-button tone="neutral" variant="secondary">
            View rewards
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
