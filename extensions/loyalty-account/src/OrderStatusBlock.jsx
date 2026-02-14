/** @jsxImportSource preact */
// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useState, useEffect} from 'preact/hooks';

export default async () => {
  try {
    render(<OrderStatusBlock />, document.body);
  } catch (e) {
    render(
      <s-banner tone="critical">
        <s-text>Extension error: {String(e)}</s-text>
      </s-banner>,
      document.body,
    );
  }
};

const TIERS = [
  {name: 'Bronze', minSpend: 0, pct: 5},
  {name: 'Silver', minSpend: 5000, pct: 7},
  {name: 'Gold', minSpend: 10000, pct: 10},
];

function OrderStatusBlock() {
  const [spent, setSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await fetch(
          'shopify:customer-account/api/2025-10/graphql.json',
          {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              query: `{
                customer {
                  orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
                    nodes {
                      processedAt
                      totalPrice { amount }
                    }
                  }
                }
              }`,
            }),
          },
        );
        if (resp.ok) {
          const json = await resp.json();
          const now = new Date();
          const cutoff = new Date(now);
          cutoff.setFullYear(now.getFullYear() - 1);
          let total = 0;
          for (const o of json?.data?.customer?.orders?.nodes || []) {
            if (new Date(o.processedAt) >= cutoff) {
              total += parseFloat(o.totalPrice?.amount || '0');
            }
          }
          setSpent(Math.round(total * 100) / 100);
        }
      } catch (e) {
        console.warn('OrderStatusBlock fetch error:', e);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  let tierIdx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (spent >= TIERS[i].minSpend) { tierIdx = i; break; }
  }
  const tier = TIERS[tierIdx];
  const nextTier = tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null;

  return (
    <s-section heading="Loyalty Rewards">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        <s-banner tone="success">
          <s-text>
            You earned {tier.pct}% cashback on this order as a {tier.name} tier member!
            Store credit is added to your account automatically.
          </s-text>
        </s-banner>

        {nextTier && !loading && (
          <s-stack direction="block" gap="small">
            <s-text color="subdued" type="small">
              {shopify.i18n.formatCurrency(Math.max(0, nextTier.minSpend - spent), {currency: 'EUR'})} more
              to reach {nextTier.name} ({nextTier.pct}% cashback)
            </s-text>
            <s-progress
              value={Math.min(100, Math.round(((spent - tier.minSpend) / (nextTier.minSpend - tier.minSpend)) * 100))}
              max={100}
              accessibilityLabel="Progress to next tier"
            />
          </s-stack>
        )}

        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          {TIERS.map((t, i) => (
            <s-stack key={t.name} direction="block" gap="small" alignItems="center">
              <s-text type={i === tierIdx ? 'strong' : 'generic'}>
                {t.name}
              </s-text>
              <s-text tone={i === tierIdx ? 'success' : 'auto'} type="strong">
                {t.pct}%
              </s-text>
            </s-stack>
          ))}
        </s-grid>
      </s-stack>
    </s-section>
  );
}
