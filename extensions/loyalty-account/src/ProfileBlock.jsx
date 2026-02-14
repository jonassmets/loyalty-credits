/** @jsxImportSource preact */
// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useState, useEffect} from 'preact/hooks';

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

const TIERS = [
  {name: 'Bronze', minSpend: 0, maxSpend: 5000, pct: 5},
  {name: 'Silver', minSpend: 5000, maxSpend: 10000, pct: 7},
  {name: 'Gold', minSpend: 10000, maxSpend: null, pct: 10},
];

function ProfileBlock() {
  const [spent, setSpent] = useState(null);
  const [balance, setBalance] = useState(null);
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
                  storeCreditAccounts(first: 5) {
                    nodes {
                      balance { amount currencyCode }
                    }
                  }
                }
              }`,
            }),
          },
        );
        if (resp.ok) {
          const json = await resp.json();
          const customer = json?.data?.customer;
          const now = new Date();
          const cutoff = new Date(now);
          cutoff.setFullYear(now.getFullYear() - 1);
          let total = 0;
          for (const o of customer?.orders?.nodes || []) {
            if (new Date(o.processedAt) >= cutoff) {
              total += parseFloat(o.totalPrice?.amount || '0');
            }
          }
          setSpent(Math.round(total * 100) / 100);
          const accounts = customer?.storeCreditAccounts?.nodes || [];
          setBalance(accounts.length > 0 ? parseFloat(accounts[0].balance?.amount || '0') : 0);
        }
      } catch (e) {
        console.warn('ProfileBlock fetch error:', e);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const spentVal = spent ?? 0;
  let tierIdx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (spentVal >= TIERS[i].minSpend) { tierIdx = i; break; }
  }
  const tier = TIERS[tierIdx];
  const nextTier = tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null;
  const progressVal = nextTier
    ? Math.min(100, Math.round(((spentVal - tier.minSpend) / (nextTier.minSpend - tier.minSpend)) * 100))
    : 100;
  const toNext = nextTier ? Math.max(0, nextTier.minSpend - spentVal) : 0;

  const fmt = (n) => shopify.i18n.formatCurrency(n, {currency: 'EUR'});

  return (
    <s-section heading="Loyalty Rewards">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        {/* Tier + Balance row */}
        <s-grid gridTemplateColumns="1fr 1fr" gap="large">
          <s-stack direction="block" gap="small">
            <s-text color="subdued" type="small">Your tier</s-text>
            <s-heading>{loading ? '...' : tier.name}</s-heading>
            <s-badge tone="auto">{tier.pct}% cashback</s-badge>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text color="subdued" type="small">Store credit balance</s-text>
            <s-heading>{loading ? '...' : fmt(balance ?? 0)}</s-heading>
            <s-text color="subdued" type="small">Applied at checkout</s-text>
          </s-stack>
        </s-grid>

        <s-divider />

        {/* Progress to next tier */}
        {nextTier ? (
          <s-stack direction="block" gap="small">
            <s-stack direction="inline" justifyContent="space-between">
              <s-text color="subdued" type="small">
                Spent (12 months): {loading ? '...' : fmt(spentVal)}
              </s-text>
              <s-text color="subdued" type="small">
                {nextTier.name} at {fmt(nextTier.minSpend)}
              </s-text>
            </s-stack>
            <s-progress value={progressVal} max={100} accessibilityLabel="Progress to next tier" />
            <s-text color="subdued" type="small">
              {loading ? '...' : fmt(toNext)} to reach {nextTier.name} and unlock {nextTier.pct}% cashback
            </s-text>
          </s-stack>
        ) : (
          <s-stack direction="block" gap="small">
            <s-text color="subdued" type="small">
              Spent (12 months): {loading ? '...' : fmt(spentVal)}
            </s-text>
            <s-progress value={100} max={100} accessibilityLabel="Top tier reached" />
            <s-text tone="success" type="strong">Top tier reached! You earn the maximum cashback.</s-text>
          </s-stack>
        )}

        <s-divider />

        {/* All tiers */}
        <s-text color="subdued" type="small">All tiers (rolling 12 months)</s-text>
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          {TIERS.map((t, i) => (
            <s-box
              key={t.name}
              border={i === tierIdx ? 'base' : 'none'}
              borderRadius="base"
              padding="small"
              background={i === tierIdx ? 'subdued' : 'transparent'}
            >
              <s-stack direction="block" gap="small" alignItems="center">
                <s-text type={i === tierIdx ? 'strong' : 'generic'}>{t.name}</s-text>
                <s-text color="subdued" type="small">
                  {t.maxSpend ? `${fmt(t.minSpend)} – ${fmt(t.maxSpend)}` : `${fmt(t.minSpend)}+`}
                </s-text>
                <s-text tone="success" type="strong">{t.pct}%</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-grid>

        {/* CTA */}
        <s-stack direction="inline" gap="base">
          <s-button tone="neutral" variant="secondary" href="extension:loyalty-rewards-page/">
            View full rewards
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
