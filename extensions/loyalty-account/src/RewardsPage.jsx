import { render } from "preact";

export default async (api) => {
  render(<RewardsPage api={api} />, document.body);
};

function RewardsPage({ api }) {
  const i18n = api.i18n;

  const tiers = [
    { name: "Bronze", minSpend: 0, maxSpend: 5000, percentage: 5 },
    { name: "Silver", minSpend: 5000, maxSpend: 10000, percentage: 7 },
    { name: "Gold", minSpend: 10000, maxSpend: null, percentage: 10 },
  ];

  return (
    <s-page heading="My Rewards">
      <s-stack direction="block" gap="large">
        {/* Intro */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text type="strong" color="subdued">
              LOYALTY PROGRAM
            </s-text>
            <s-text>
              Earn store credit on every purchase! Your cashback percentage
              is based on how much you've spent in the last 12 months.
              The more you shop, the more you earn back.
            </s-text>
            <s-banner tone="info">
              <s-text>
                Store credit is applied automatically at checkout — no codes
                needed. It works online, with Shop Pay, and at POS.
              </s-text>
            </s-banner>
          </s-stack>
        </s-section>

        {/* Tiers */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text type="strong" color="subdued">
              SPENDING TIERS
            </s-text>
            <s-text color="subdued">
              Your tier is based on your total spending in the last 12 months.
              Keep shopping to maintain or increase your tier!
            </s-text>

            {tiers.map((t) => (
              <s-card key={t.name}>
                <s-stack direction="inline" inline-alignment="space-between" gap="base">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">{t.name}</s-text>
                    <s-text color="subdued">
                      {t.maxSpend
                        ? `${i18n.formatCurrency(t.minSpend, { currency: "EUR" })} – ${i18n.formatCurrency(t.maxSpend, { currency: "EUR" })}`
                        : `${i18n.formatCurrency(t.minSpend, { currency: "EUR" })}+`}
                      {" "}spent in 12 months
                    </s-text>
                  </s-stack>
                  <s-text type="strong" tone="success">
                    {t.percentage}% cashback
                  </s-text>
                </s-stack>
              </s-card>
            ))}
          </s-stack>
        </s-section>

        {/* How it works */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text type="strong" color="subdued">
              HOW IT WORKS
            </s-text>
            <s-stack direction="block" gap="small">
              <s-text>
                1. Shop as usual — every purchase counts toward your tier.
              </s-text>
              <s-text>
                2. Your tier is based on your spending in the last 12 months.
              </s-text>
              <s-text>
                3. After each order, you receive your tier's percentage as store credit.
              </s-text>
              <s-text>
                4. Store credit is applied automatically at your next checkout.
              </s-text>
              <s-text>
                5. Stay active to keep your tier — if you don't purchase for
                a year, your tier resets to Bronze.
              </s-text>
            </s-stack>
          </s-stack>
        </s-section>

        {/* Example */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text type="strong" color="subdued">
              EXAMPLE
            </s-text>
            <s-text>
              You've spent {i18n.formatCurrency(6500, { currency: "EUR" })}{" "}
              in the last 12 months, so you're in the <s-text type="strong">Silver</s-text> tier.
            </s-text>
            <s-text>
              Your next order of {i18n.formatCurrency(100, { currency: "EUR" })}{" "}
              earns you {i18n.formatCurrency(7, { currency: "EUR" })} in store
              credit (7% cashback).
            </s-text>
            <s-text color="subdued">
              Spend {i18n.formatCurrency(3500, { currency: "EUR" })} more to
              reach Gold and earn 10% cashback on every order!
            </s-text>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
