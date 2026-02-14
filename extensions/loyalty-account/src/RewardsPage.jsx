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

function useSettings() {
  const s = shopify.settings?.current?.value || {};
  return {
    currency: s.currency || 'EUR',
    showFaq: s.show_faq !== false,
    showHowItWorks: s.show_how_it_works !== false,
  };
}

function RewardsPage() {
  const tiers = useTiers();
  const settings = useSettings();
  const [spent, setSpent] = useState(null);
  const [balance, setBalance] = useState(null);
  const [orderCount, setOrderCount] = useState(null);
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
                  storeCreditAccounts(first: 5) {
                    nodes { balance { amount currencyCode } }
                  }
                }
              }`,
            }),
          },
        );
        if (resp.ok) {
          const json = await resp.json();
          const customer = json?.data?.customer;
          const cutoff = new Date();
          cutoff.setFullYear(cutoff.getFullYear() - 1);
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
          const accts = customer?.storeCreditAccounts?.nodes || [];
          setBalance(accts.length > 0 ? parseFloat(accts[0].balance?.amount || '0') : 0);
        }
      } catch (e) {
        console.warn('RewardsPage fetch error:', e);
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
  const progressVal = nextTier
    ? Math.min(100, Math.round(((spentVal - tier.minSpend) / (nextTier.minSpend - tier.minSpend)) * 100))
    : 100;
  const toNext = nextTier ? Math.max(0, nextTier.minSpend - spentVal) : 0;
  const fmt = (n) => shopify.i18n.formatCurrency(n, {currency: settings.currency});

  return (
    <s-page heading="Your loyalty rewards">
      <s-stack direction="block" gap="large">

        {/* ── Stats overview ── */}
        <s-section>
          <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="large">
            <s-stack direction="block" gap="small" alignItems="center">
              <s-text color="subdued" type="small">Current tier</s-text>
              <s-heading>{loading ? '...' : tier.name}</s-heading>
              <s-badge tone="auto">{tier.pct}% cashback</s-badge>
            </s-stack>
            <s-stack direction="block" gap="small" alignItems="center">
              <s-text color="subdued" type="small">Store credit balance</s-text>
              <s-heading>{loading ? '...' : fmt(balance ?? 0)}</s-heading>
              <s-text color="subdued" type="small">Applied at checkout</s-text>
            </s-stack>
            <s-stack direction="block" gap="small" alignItems="center">
              <s-text color="subdued" type="small">Orders (12 months)</s-text>
              <s-heading>{loading ? '...' : orderCount}</s-heading>
              <s-text color="subdued" type="small">Total: {loading ? '...' : fmt(spentVal)}</s-text>
            </s-stack>
          </s-grid>
        </s-section>

        {/* ── Progress ── */}
        <s-section heading={nextTier ? `Progress to ${nextTier.name}` : 'Top tier reached'}>
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            {nextTier ? (
              <>
                <s-stack direction="inline" justifyContent="space-between">
                  <s-text color="subdued" type="small">
                    {loading ? '...' : fmt(spentVal)} spent
                  </s-text>
                  <s-text color="subdued" type="small">{fmt(nextTier.minSpend)}</s-text>
                </s-stack>
                <s-progress value={progressVal} max={100} accessibilityLabel="Progress to next tier" />
                <s-text color="subdued" type="small">
                  Spend {loading ? '...' : fmt(toNext)} more to reach {nextTier.name} and unlock {nextTier.pct}% cashback
                </s-text>
              </>
            ) : (
              <>
                <s-progress value={100} max={100} accessibilityLabel="Top tier reached" />
                <s-text tone="success" type="strong">
                  Congratulations! You've reached {tier.name} — our highest tier
                </s-text>
              </>
            )}
          </s-stack>
        </s-section>

        {/* ── Tier overview ── */}
        <s-section heading="Tier overview">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
              {tiers.map((t, i) => (
                <s-box
                  key={t.name}
                  border={i === tierIdx ? 'base' : 'none'}
                  borderRadius="base"
                  padding="base"
                  background={i === tierIdx ? 'subdued' : 'transparent'}
                >
                  <s-stack direction="block" gap="small" alignItems="center">
                    <s-heading>{t.name}</s-heading>
                    <s-text color="subdued" type="small">
                      {t.maxSpend ? `${fmt(t.minSpend)} – ${fmt(t.maxSpend)}` : `${fmt(t.minSpend)}+`}
                    </s-text>
                    <s-text tone="success" type="strong">{t.pct}% cashback</s-text>
                    {i === tierIdx && <s-badge tone="auto">Your tier</s-badge>}
                  </s-stack>
                </s-box>
              ))}
            </s-grid>
          </s-stack>
        </s-section>

        {/* ── How it works ── */}
        {settings.showHowItWorks && (
          <s-section heading="How it works">
            <s-stack direction="block" gap="base" paddingBlockStart="base">
              <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
                <s-box border="base" borderRadius="base" padding="base">
                  <s-stack direction="block" gap="small" alignItems="center">
                    <s-heading>1. Shop</s-heading>
                    <s-text>Every purchase adds to your 12-month rolling spend total</s-text>
                  </s-stack>
                </s-box>
                <s-box border="base" borderRadius="base" padding="base">
                  <s-stack direction="block" gap="small" alignItems="center">
                    <s-heading>2. Earn</s-heading>
                    <s-text>Receive store credit as a percentage of each order</s-text>
                  </s-stack>
                </s-box>
                <s-box border="base" borderRadius="base" padding="base">
                  <s-stack direction="block" gap="small" alignItems="center">
                    <s-heading>3. Save</s-heading>
                    <s-text>Store credit is automatically applied at checkout</s-text>
                  </s-stack>
                </s-box>
              </s-grid>
            </s-stack>
          </s-section>
        )}

        {/* ── FAQ ── */}
        {settings.showFaq && (
          <s-section heading="Frequently asked questions">
            <s-stack direction="block" gap="base" paddingBlockStart="base">
              <s-stack direction="block" gap="small">
                <s-text type="strong">How is my tier calculated?</s-text>
                <s-text>Your tier is based on your total spending in the last 12 months (rolling window). As your spending grows, you automatically move to higher tiers.</s-text>
              </s-stack>
              <s-divider />
              <s-stack direction="block" gap="small">
                <s-text type="strong">When do I receive my store credit?</s-text>
                <s-text>Store credit is added to your account shortly after your order is confirmed and paid.</s-text>
              </s-stack>
              <s-divider />
              <s-stack direction="block" gap="small">
                <s-text type="strong">How do I use my store credit?</s-text>
                <s-text>Your store credit balance is automatically applied at checkout. No codes or extra steps needed.</s-text>
              </s-stack>
              <s-divider />
              <s-stack direction="block" gap="small">
                <s-text type="strong">Can I lose my tier?</s-text>
                <s-text>Tiers are recalculated based on a rolling 12-month window. If your spending drops below a tier threshold, your tier adjusts accordingly.</s-text>
              </s-stack>
            </s-stack>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}
