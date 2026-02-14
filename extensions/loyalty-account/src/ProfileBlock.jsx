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

/* ── Default tiers (will be overridden by app settings via metafield) ── */
const DEFAULT_TIERS = [
  {name: 'Bronze', minSpend: 0, maxSpend: 5000, pct: 5},
  {name: 'Silver', minSpend: 5000, maxSpend: 10000, pct: 7},
  {name: 'Gold', minSpend: 10000, maxSpend: null, pct: 10},
];

/* ── Colors ── */
const TIER_COLORS = ['#3b82f6', '#a855f7', '#f59e0b'];
const BG = '#111827';
const BG_CARD = '#1f2937';
const TEXT = '#f9fafb';
const TEXT_SUB = '#9ca3af';
const ACCENT = '#22c55e';

function ProfileBlock() {
  const [tiers] = useState(DEFAULT_TIERS);
  const [totalSpent, setTotalSpent] = useState(null);
  const [creditBalance, setCreditBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch order history to calculate 12-month spend
        const ordersResp = await fetch(
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

        if (ordersResp.ok) {
          const json = await ordersResp.json();
          const customer = json?.data?.customer;

          // Calculate rolling 12-month spend
          const now = new Date();
          const twelveMonthsAgo = new Date(now);
          twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

          let spend = 0;
          const orders = customer?.orders?.nodes || [];
          for (const order of orders) {
            const orderDate = new Date(order.processedAt);
            if (orderDate >= twelveMonthsAgo) {
              spend += parseFloat(order.totalPrice?.amount || '0');
            }
          }
          setTotalSpent(Math.round(spend * 100) / 100);

          // Get store credit balance
          const accounts = customer?.storeCreditAccounts?.nodes || [];
          if (accounts.length > 0) {
            setCreditBalance(parseFloat(accounts[0].balance?.amount || '0'));
          } else {
            setCreditBalance(0);
          }
        }
      } catch (e) {
        console.warn('Could not fetch loyalty data:', e);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // Determine current tier
  const spent = totalSpent ?? 0;
  let currentTier = tiers[0];
  let currentTierIndex = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (spent >= tiers[i].minSpend) {
      currentTier = tiers[i];
      currentTierIndex = i;
      break;
    }
  }

  // Progress to next tier
  const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;
  const progressMax = nextTier ? nextTier.minSpend : currentTier.maxSpend || spent;
  const progressPct = nextTier
    ? Math.min(100, ((spent - currentTier.minSpend) / (nextTier.minSpend - currentTier.minSpend)) * 100)
    : 100;
  const toNextTier = nextTier ? Math.max(0, nextTier.minSpend - spent) : 0;

  const formatMoney = (n) => {
    if (n == null) return '...';
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  };

  return (
    <s-section>
      <s-stack direction="block" gap="none">
        {/* ── Main loyalty card ── */}
        <div
          style={`
            background: ${BG};
            border-radius: 16px;
            padding: 0;
            color: ${TEXT};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
          `}
        >
          {/* ── Top section: Tier + Balance (landscape on desktop) ── */}
          <div
            class="loyalty-card-top"
            style={`
              display: flex;
              flex-wrap: wrap;
              gap: 0;
            `}
          >
            {/* Left: Tier info */}
            <div
              style={`
                flex: 1 1 280px;
                padding: 24px 28px;
                display: flex;
                flex-direction: column;
                gap: 8px;
              `}
            >
              <div
                style={`
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                `}
              >
                <div>
                  <div style={`font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${TEXT_SUB};`}>
                    Your Tier
                  </div>
                  <div style={`font-size: 28px; font-weight: 800; color: ${TIER_COLORS[currentTierIndex] || ACCENT}; margin-top: 2px;`}>
                    {currentTier.name}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style={`font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${TEXT_SUB};`}>
                    Balance
                  </div>
                  <div style={`font-size: 24px; font-weight: 700; color: ${ACCENT}; margin-top: 2px;`}>
                    {loading ? '...' : formatMoney(creditBalance)}
                  </div>
                </div>
              </div>

              <div style={`font-size: 14px; color: ${TEXT}; margin-top: 4px;`}>
                You get <strong style={`color: ${ACCENT};`}>{currentTier.pct}%</strong> cashback on every purchase
              </div>

              {/* Progress bar */}
              {nextTier && (
                <div style="margin-top: 8px;">
                  <div style={`display: flex; justify-content: space-between; font-size: 12px; color: ${TEXT_SUB}; margin-bottom: 6px;`}>
                    <span>Spent: {loading ? '...' : formatMoney(spent)}</span>
                    <span>Next: {nextTier.name} at {formatMoney(nextTier.minSpend)}</span>
                  </div>
                  <div style={`background: #374151; border-radius: 6px; height: 10px; overflow: hidden;`}>
                    <div style={`
                      width: ${progressPct}%;
                      height: 100%;
                      background: linear-gradient(90deg, ${TIER_COLORS[currentTierIndex] || ACCENT}, ${TIER_COLORS[currentTierIndex + 1] || ACCENT});
                      border-radius: 6px;
                      transition: width 0.5s ease;
                    `}></div>
                  </div>
                  <div style={`font-size: 12px; color: ${TEXT_SUB}; margin-top: 4px;`}>
                    {loading ? '...' : formatMoney(toNextTier)} to reach {nextTier.name} ({nextTier.pct}% back)
                  </div>
                </div>
              )}
              {!nextTier && (
                <div style="margin-top: 8px;">
                  <div style={`display: flex; justify-content: space-between; font-size: 12px; color: ${TEXT_SUB}; margin-bottom: 6px;`}>
                    <span>Spent: {loading ? '...' : formatMoney(spent)}</span>
                    <span>Top tier reached!</span>
                  </div>
                  <div style={`background: #374151; border-radius: 6px; height: 10px; overflow: hidden;`}>
                    <div style={`width: 100%; height: 100%; background: ${ACCENT}; border-radius: 6px;`}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Tier breakdown */}
            <div
              style={`
                flex: 0 1 260px;
                padding: 24px 28px;
                background: ${BG_CARD};
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 12px;
              `}
            >
              <div style={`font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${TEXT_SUB}; margin-bottom: 4px;`}>
                All Tiers
              </div>
              {tiers.map((t, i) => {
                const isActive = i === currentTierIndex;
                return (
                  <div
                    key={t.name}
                    style={`
                      display: flex;
                      align-items: center;
                      gap: 12px;
                      padding: 8px 12px;
                      border-radius: 8px;
                      background: ${isActive ? 'rgba(255,255,255,0.08)' : 'transparent'};
                      border: 1px solid ${isActive ? (TIER_COLORS[i] || ACCENT) : 'transparent'};
                    `}
                  >
                    <div
                      style={`
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: ${TIER_COLORS[i] || TEXT_SUB};
                        flex-shrink: 0;
                      `}
                    ></div>
                    <div style="flex: 1;">
                      <div style={`font-size: 13px; font-weight: ${isActive ? '700' : '500'}; color: ${isActive ? TEXT : TEXT_SUB};`}>
                        {t.name}
                      </div>
                      <div style={`font-size: 11px; color: ${TEXT_SUB};`}>
                        {t.maxSpend ? `${formatMoney(t.minSpend)} – ${formatMoney(t.maxSpend)}` : `${formatMoney(t.minSpend)}+`}
                      </div>
                    </div>
                    <div style={`font-size: 16px; font-weight: 700; color: ${TIER_COLORS[i] || ACCENT};`}>
                      {t.pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Bottom bar ── */}
          <div
            style={`
              padding: 12px 28px;
              background: rgba(255,255,255,0.03);
              border-top: 1px solid rgba(255,255,255,0.06);
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 8px;
            `}
          >
            <div style={`font-size: 12px; color: ${TEXT_SUB};`}>
              Tier based on rolling 12-month spending. Credit applied at checkout.
            </div>
            <s-button tone="neutral" variant="secondary" href="extension:loyalty-rewards-page/">
              View full rewards
            </s-button>
          </div>
        </div>
      </s-stack>

      {/* Responsive: stack vertically on mobile */}
      <style>{`
        @media (max-width: 640px) {
          .loyalty-card-top {
            flex-direction: column !important;
          }
        }
      `}</style>
    </s-section>
  );
}
