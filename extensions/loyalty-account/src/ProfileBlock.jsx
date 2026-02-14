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
    heading: s.heading || 'Loyalty Rewards',
    currency: s.currency || 'EUR',
    showBalance: s.show_balance !== false,
    showProgress: s.show_progress !== false,
    showAllTiers: s.show_all_tiers !== false,
  };
}

function ProfileBlock() {
  const tiers = useTiers();
  const settings = useSettings();
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
          for (const o of customer?.orders?.nodes || []) {
            if (new Date(o.processedAt) >= cutoff) {
              total += parseFloat(o.totalPrice?.amount || '0');
            }
          }
          setSpent(Math.round(total * 100) / 100);
          const accts = customer?.storeCreditAccounts?.nodes || [];
          setBalance(accts.length > 0 ? parseFloat(accts[0].balance?.amount || '0') : 0);
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
    <s-section heading={settings.heading}>
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        {/* Tier + Balance */}
        <s-grid gridTemplateColumns={settings.showBalance ? '1fr 1fr' : '1fr'} gap="large">
          <s-stack direction="block" gap="small">
            <s-text color="subdued" type="small">Your tier</s-text>
            <s-heading>{loading ? '...' : tier.name}</s-heading>
            <s-badge tone="auto">{tier.pct}% cashback</s-badge>
          </s-stack>
          {settings.showBalance && (
            <s-stack direction="block" gap="small">
              <s-text color="subdued" type="small">Store credit balance</s-text>
              <s-heading>{loading ? '...' : fmt(balance ?? 0)}</s-heading>
              <s-text color="subdued" type="small">Applied at checkout</s-text>
            </s-stack>
          )}
        </s-grid>

        {/* Progress */}
        {settings.showProgress && (
          <>
            <s-divider />
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
                <s-text tone="success" type="strong">Top tier reached!</s-text>
              </s-stack>
            )}
          </>
        )}

        {/* All tiers */}
        {settings.showAllTiers && (
          <>
            <s-divider />
            <s-text color="subdued" type="small">All tiers (rolling 12 months)</s-text>
            <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
              {tiers.map((t, i) => (
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
          </>
        )}

        <s-stack direction="inline" gap="base">
          <s-button tone="neutral" variant="secondary" href="extension:loyalty-rewards-page/">
            View full rewards
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
