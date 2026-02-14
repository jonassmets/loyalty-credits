/** @jsxImportSource preact */
// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useState, useEffect} from 'preact/hooks';

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

const TIERS = [
  {name: 'Bronze', minSpend: 0, maxSpend: 5000, pct: 5},
  {name: 'Silver', minSpend: 5000, maxSpend: 10000, pct: 7},
  {name: 'Gold', minSpend: 10000, maxSpend: null, pct: 10},
];

function RewardsPage() {
  const [spent, setSpent] = useState(0);
  const [balance, setBalance] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
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
                  orders(first: 100, sortKey: PROCESSED_AT, reverse: true) {
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
          let count = 0;
          for (const o of customer?.orders?.nodes || []) {
            if (new Date(o.processedAt) >= cutoff) {
              total += parseFloat(o.totalPrice?.amount || '0');
              count++;
            }
          }
          setSpent(Math.round(total * 100) / 100);
          setOrderCount(count);
          const accounts = customer?.storeCreditAccounts?.nodes || [];
          setBalance(accounts.length > 0 ? parseFloat(accounts[0].balance?.amount || '0') : 0);
        }
      } catch (e) {
        console.warn('RewardsPage fetch error:', e);
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
  const progressVal = nextTier
    ? Math.min(100, Math.round(((spent - tier.minSpend) / (nextTier.minSpend - tier.minSpend)) * 100))
    : 100;
  const toNext = nextTier ? Math.max(0, nextTier.minSpend - spent) : 0;
  const fmt = (n) => shopify.i18n.formatCurrency(n, {currency: 'EUR'});

  return (
    <s-page heading="My Rewards">
      <s-stack direction="block" gap="large">

        {/* ── Overview stats ── */}
        <s-section heading="Your Status">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="large">
              <s-stack direction="block" gap="small">
                <s-text color="subdued" type="small">Current tier</s-text>
                <s-heading>{loading ? '...' : tier.name}</s-heading>
                <s-badge tone="auto">{tier.pct}% cashback</s-badge>
              </s-stack>
              <s-stack direction="block" gap="small">
                <s-text color="subdued" type="small">Store credit</s-text>
                <s-heading>{loading ? '...' : fmt(balance)}</s-heading>
                <s-text color="subdued" type="small">Auto-applied at checkout</s-text>
              </s-stack>
              <s-stack direction="block" gap="small">
                <s-text color="subdued" type="small">Orders (12m)</s-text>
                <s-heading>{loading ? '...' : orderCount}</s-heading>
                <s-text color="subdued" type="small">
                  Total: {loading ? '...' : fmt(spent)}
                </s-text>
              </s-stack>
            </s-grid>
          </s-stack>
        </s-section>

        {/* ── Progress ── */}
        <s-section heading="Tier Progress">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            {nextTier ? (
              <s-stack direction="block" gap="small">
                <s-stack direction="inline" justifyContent="space-between">
                  <s-text color="subdued" type="small">
                    Spent: {loading ? '...' : fmt(spent)}
                  </s-text>
                  <s-text color="subdued" type="small">
                    {nextTier.name} at {fmt(nextTier.minSpend)}
                  </s-text>
                </s-stack>
                <s-progress value={progressVal} max={100} accessibilityLabel="Progress to next tier" />
                <s-text>
                  {loading ? '...' : fmt(toNext)} more to reach <s-text type="strong">{nextTier.name}</s-text> and
                  unlock {nextTier.pct}% cashback on every order.
                </s-text>
              </s-stack>
            ) : (
              <s-stack direction="block" gap="small">
                <s-progress value={100} max={100} accessibilityLabel="Top tier reached" />
                <s-text tone="success" type="strong">
                  You have reached the highest tier! You earn {tier.pct}% on every purchase.
                </s-text>
              </s-stack>
            )}
          </s-stack>
        </s-section>

        {/* ── All tiers ── */}
        <s-section heading="Spending Tiers">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text color="subdued">
              Your tier is based on total spending in the last 12 months.
            </s-text>
            {TIERS.map((t, i) => (
              <s-box
                key={t.name}
                border={i === tierIdx ? 'base' : 'none'}
                borderRadius="base"
                padding="base"
                background={i === tierIdx ? 'subdued' : 'transparent'}
              >
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">{t.name}</s-text>
                    <s-text color="subdued" type="small">
                      {t.maxSpend
                        ? `Spend ${fmt(t.minSpend)} – ${fmt(t.maxSpend)} in 12 months`
                        : `Spend ${fmt(t.minSpend)}+ in 12 months`}
                    </s-text>
                  </s-stack>
                  <s-text tone="success" type="strong">{t.pct}% back</s-text>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>

        {/* ── How it works ── */}
        <s-section heading="How it works">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text>1. Shop as usual — every order counts toward your spending tier.</s-text>
            <s-text>2. Your tier is determined by spending in the last 12 months on a rolling basis.</s-text>
            <s-text>3. After each order, your tier's cashback percentage is added as store credit.</s-text>
            <s-text>4. Store credit is applied automatically at checkout — no code needed.</s-text>
            <s-text>5. Keep shopping to maintain or upgrade your tier!</s-text>
          </s-stack>
        </s-section>

        {/* ── FAQ ── */}
        <s-section heading="FAQ">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text type="strong">When do I receive my cashback?</s-text>
            <s-text>Store credit is added shortly after each paid order.</s-text>

            <s-text type="strong">Can I combine store credit with discount codes?</s-text>
            <s-text>Yes — store credit is applied separately alongside any promotions.</s-text>

            <s-text type="strong">What if I don't shop for a while?</s-text>
            <s-text>
              Your tier is recalculated based on a rolling 12-month window.
              If spending drops below a threshold, you move to a lower tier.
            </s-text>

            <s-text type="strong">Does store credit expire?</s-text>
            <s-text>Check the store's terms for credit expiration details.</s-text>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
