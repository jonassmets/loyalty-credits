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
const TIER_COLORS = ['#3b82f6', '#a855f7', '#f59e0b'];
const BG = '#111827';
const BG_CARD = '#1f2937';
const TEXT = '#f9fafb';
const TEXT_SUB = '#9ca3af';
const ACCENT = '#22c55e';

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
          if (accounts.length > 0) {
            setBalance(parseFloat(accounts[0].balance?.amount || '0'));
          }
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
    if (spent >= TIERS[i].minSpend) {
      tierIdx = i;
      break;
    }
  }
  const tier = TIERS[tierIdx];
  const nextTier = tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null;
  const progressPct = nextTier
    ? Math.min(100, ((spent - tier.minSpend) / (nextTier.minSpend - tier.minSpend)) * 100)
    : 100;
  const toNext = nextTier ? Math.max(0, nextTier.minSpend - spent) : 0;

  const fmt = (n) =>
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <s-page heading="My Rewards">
      <s-stack direction="block" gap="large">
        {/* ── Hero Card ── */}
        <s-section>
          <div
            style={`
              background: ${BG};
              border-radius: 16px;
              color: ${TEXT};
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              overflow: hidden;
            `}
          >
            <div style="display: flex; flex-wrap: wrap;">
              {/* Stats */}
              <div style={`flex: 1 1 300px; padding: 28px;`}>
                <div style="display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 20px;">
                  <div>
                    <div style={`font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${TEXT_SUB};`}>Your Tier</div>
                    <div style={`font-size: 32px; font-weight: 800; color: ${TIER_COLORS[tierIdx]}; margin-top: 2px;`}>
                      {loading ? '...' : tier.name}
                    </div>
                  </div>
                  <div>
                    <div style={`font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${TEXT_SUB};`}>Balance</div>
                    <div style={`font-size: 28px; font-weight: 700; color: ${ACCENT}; margin-top: 2px;`}>
                      {loading ? '...' : fmt(balance)}
                    </div>
                  </div>
                  <div>
                    <div style={`font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${TEXT_SUB};`}>Cashback</div>
                    <div style={`font-size: 28px; font-weight: 700; color: ${TEXT}; margin-top: 2px;`}>
                      {tier.pct}%
                    </div>
                  </div>
                </div>

                {/* Progress */}
                {nextTier ? (
                  <div>
                    <div style={`display: flex; justify-content: space-between; font-size: 12px; color: ${TEXT_SUB}; margin-bottom: 6px;`}>
                      <span>Spent: {loading ? '...' : fmt(spent)}</span>
                      <span>{nextTier.name} at {fmt(nextTier.minSpend)}</span>
                    </div>
                    <div style="background: #374151; border-radius: 8px; height: 12px; overflow: hidden;">
                      <div style={`width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, ${TIER_COLORS[tierIdx]}, ${TIER_COLORS[tierIdx + 1]}); border-radius: 8px; transition: width 0.5s;`}></div>
                    </div>
                    <div style={`font-size: 12px; color: ${TEXT_SUB}; margin-top: 6px;`}>
                      {loading ? '...' : fmt(toNext)} more to unlock {nextTier.name} ({nextTier.pct}% back)
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={`font-size: 12px; color: ${TEXT_SUB}; margin-bottom: 6px;`}>
                      Spent: {loading ? '...' : fmt(spent)} — Top tier reached!
                    </div>
                    <div style="background: #374151; border-radius: 8px; height: 12px; overflow: hidden;">
                      <div style={`width: 100%; height: 100%; background: ${ACCENT}; border-radius: 8px;`}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tier list */}
              <div style={`flex: 0 1 240px; padding: 28px; background: ${BG_CARD};`}>
                <div style={`font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${TEXT_SUB}; margin-bottom: 16px;`}>
                  Tier Overview
                </div>
                {TIERS.map((t, i) => {
                  const active = i === tierIdx;
                  return (
                    <div
                      key={t.name}
                      style={`
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 10px 12px;
                        border-radius: 8px;
                        margin-bottom: 6px;
                        background: ${active ? 'rgba(255,255,255,0.08)' : 'transparent'};
                        border: 1px solid ${active ? TIER_COLORS[i] : 'transparent'};
                      `}
                    >
                      <div style={`width: 10px; height: 10px; border-radius: 50%; background: ${TIER_COLORS[i]}; flex-shrink: 0;`}></div>
                      <div style="flex: 1;">
                        <div style={`font-size: 14px; font-weight: ${active ? '700' : '500'}; color: ${active ? TEXT : TEXT_SUB};`}>{t.name}</div>
                        <div style={`font-size: 11px; color: ${TEXT_SUB};`}>
                          {t.maxSpend ? `${fmt(t.minSpend)} – ${fmt(t.maxSpend)}` : `${fmt(t.minSpend)}+`}
                        </div>
                      </div>
                      <div style={`font-size: 18px; font-weight: 700; color: ${TIER_COLORS[i]};`}>{t.pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={`padding: 14px 28px; background: rgba(255,255,255,0.03); border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: ${TEXT_SUB}; display: flex; gap: 24px; flex-wrap: wrap;`}>
              <span>Orders (12m): <strong style={`color: ${TEXT};`}>{loading ? '...' : orderCount}</strong></span>
              <span>Spent (12m): <strong style={`color: ${TEXT};`}>{loading ? '...' : fmt(spent)}</strong></span>
              <span>Current rate: <strong style={`color: ${ACCENT};`}>{tier.pct}%</strong></span>
            </div>
          </div>
        </s-section>

        {/* ── How it works ── */}
        <s-section heading="How it works">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text>
              1. Shop as usual — every order counts toward your spending tier.
            </s-text>
            <s-text>
              2. Your tier is based on spending in the last 12 months on a rolling basis.
            </s-text>
            <s-text>
              3. After each order, you receive your tier's cashback percentage as store credit.
            </s-text>
            <s-text>
              4. Store credit is applied automatically at checkout — no code needed.
            </s-text>
            <s-text>
              5. Keep shopping to maintain or upgrade your tier!
            </s-text>
          </s-stack>
        </s-section>

        {/* ── FAQ ── */}
        <s-section heading="Frequently asked questions">
          <s-stack direction="block" gap="base" paddingBlockStart="base">
            <s-text type="strong">When do I receive my cashback?</s-text>
            <s-text>Store credit is added to your account shortly after each order is paid.</s-text>
            <s-text type="strong">Can I combine store credit with discount codes?</s-text>
            <s-text>Yes! Store credit is applied separately and works alongside any promotions.</s-text>
            <s-text type="strong">What happens if I don't shop for a while?</s-text>
            <s-text>Your tier is recalculated based on spending in the last 12 months. If your spending drops below a tier threshold, you'll move to a lower tier.</s-text>
            <s-text type="strong">Does store credit expire?</s-text>
            <s-text>Check the store's terms — credit expiration is configured by the merchant.</s-text>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
