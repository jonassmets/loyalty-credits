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

function useTiers() {
  const s = shopify.settings?.current?.value || {};
  return [
    {
      name: s.tier1_name || 'Bronze',
      minSpend: Number(s.tier1_min) || 0,
      maxSpend: Number(s.tier2_min) || 5000,
      pct: Number(s.tier1_pct) || 5,
    },
    {
      name: s.tier2_name || 'Silver',
      minSpend: Number(s.tier2_min) || 5000,
      maxSpend: Number(s.tier3_min) || 10000,
      pct: Number(s.tier2_pct) || 7,
    },
    {
      name: s.tier3_name || 'Gold',
      minSpend: Number(s.tier3_min) || 10000,
      maxSpend: null,
      pct: Number(s.tier3_pct) || 10,
    },
  ];
}

function OrderStatusBlock() {
  const tiers = useTiers();
  const s = shopify.settings?.current?.value || {};
  const currency = s.currency || 'EUR';
  const [spent, setSpent] = useState(null);
  const [orderTotal, setOrderTotal] = useState(null);
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
                    nodes { processedAt totalPrice { amount } }
                  }
                }
              }`,
            }),
          },
        );
        if (resp.ok) {
          const json = await resp.json();
          const orders = json?.data?.customer?.orders?.nodes || [];
          const cutoff = new Date();
          cutoff.setFullYear(cutoff.getFullYear() - 1);
          let total = 0;
          for (const o of orders) {
            if (new Date(o.processedAt) >= cutoff) {
              total += parseFloat(o.totalPrice?.amount || '0');
            }
          }
          setSpent(Math.round(total * 100) / 100);
          if (orders.length > 0) {
            setOrderTotal(parseFloat(orders[0].totalPrice?.amount || '0'));
          }
        }
      } catch (e) {
        console.warn('OrderStatusBlock fetch error:', e);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const spentVal = spent ?? 0;
  let tierIdx = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (spentVal >= tiers[i].minSpend) { tierIdx = i; break; }
  }
  const tier = tiers[tierIdx];
  const nextTier = tierIdx < tiers.length - 1 ? tiers[tierIdx + 1] : null;
  const earned = orderTotal != null ? (orderTotal * tier.pct / 100).toFixed(2) : null;
  const progressVal = nextTier
    ? Math.min(100, Math.round(((spentVal - tier.minSpend) / (nextTier.minSpend - tier.minSpend)) * 100))
    : 100;
  const fmt = (n) => shopify.i18n.formatCurrency(n, {currency});

  return (
    <s-section heading="Loyalty Rewards">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        {earned != null && parseFloat(earned) > 0 && (
          <s-banner tone="success">
            <s-text>
              You earned {fmt(parseFloat(earned))} store credit on this order ({tier.pct}% {tier.name} cashback)
            </s-text>
          </s-banner>
        )}

        <s-grid gridTemplateColumns="1fr 1fr" gap="large">
          <s-stack direction="block" gap="small">
            <s-text color="subdued" type="small">Your tier</s-text>
            <s-text type="strong">{loading ? '...' : tier.name}</s-text>
            <s-badge tone="auto">{tier.pct}% cashback</s-badge>
          </s-stack>

          <s-stack direction="block" gap="small">
            <s-text color="subdued" type="small">Spent (12 months)</s-text>
            <s-text type="strong">{loading ? '...' : fmt(spentVal)}</s-text>
          </s-stack>
        </s-grid>

        {nextTier && (
          <>
            <s-divider />
            <s-stack direction="block" gap="small">
              <s-stack direction="inline" justifyContent="space-between">
                <s-text color="subdued" type="small">Progress to {nextTier.name}</s-text>
                <s-text color="subdued" type="small">{nextTier.name} at {fmt(nextTier.minSpend)}</s-text>
              </s-stack>
              <s-progress value={progressVal} max={100} accessibilityLabel="Progress to next tier" />
            </s-stack>
          </>
        )}

        <s-stack direction="inline" gap="base">
          <s-button tone="neutral" variant="secondary" href="extension:loyalty-rewards-page/">
            View rewards program
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
