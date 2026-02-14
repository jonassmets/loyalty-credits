import { render } from "preact";

export default async (api) => {
  render(<ProfileBlock api={api} />, document.body);
};

function ProfileBlock({ api }) {
  const i18n = api.i18n;

  // The loyalty tiers — kept in sync with app settings
  const tiers = [
    { name: "Bronze", minSpend: 0, percentage: 5 },
    { name: "Silver", minSpend: 5000, percentage: 7 },
    { name: "Gold", minSpend: 10000, percentage: 10 },
  ];

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" inline-alignment="space-between">
          <s-text type="strong" color="subdued">
            LOYALTY PROGRAM
          </s-text>
          <s-text type="strong" tone="success">
            Active
          </s-text>
        </s-stack>

        <s-text>
          Earn store credit on every purchase. The more you spend in the last
          12 months, the higher your cashback percentage.
        </s-text>

        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="large">
          {tiers.map((t) => (
            <s-stack key={t.name} direction="block" gap="small">
              <s-text type="strong">{t.name}</s-text>
              <s-text color="subdued">
                {t.minSpend === 0 ? "Up to" : "From"}{" "}
                {i18n.formatCurrency(t.minSpend || 5000, { currency: "EUR" })}
              </s-text>
              <s-text tone="success" type="strong">
                {t.percentage}% back
              </s-text>
            </s-stack>
          ))}
        </s-grid>

        <s-text color="subdued">
          Store credit is applied automatically at checkout. No code needed.
          Keep shopping to maintain or increase your tier!
        </s-text>
      </s-stack>
    </s-section>
  );
}
