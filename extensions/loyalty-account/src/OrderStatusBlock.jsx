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
  {name: 'Bronze', minSpend: 0, maxSpend: 5000, pct: 5},
  {name: 'Silver', minSpend: 5000, maxSpend: 10000, pct: 7},
  {name: 'Gold', minSpend: 10000, maxSpend: null, pct: 10},
];
const TIER_COLORS = ['#3b82f6', '#a855f7', '#f59e0b'];
const ACCENT = '#22c55e';

function OrderStatusBlock() {
  const [orderTotal, setOrderTotal] = useState(null);
  const [spent, setSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Try to get order info from the shopify global
        const order = shopify.order;
        if (order?.totalPrice?.value) {
          setOrderTotal(parseFloat(order.totalPrice.value.amount || '0'));
        }

        // Fetch 12-month spend
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
          const orders = json?.data?.customer?.orders?.nodes || [];
          for (const o of orders) {
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

  // Determine tier
  let tier = TIERS[0];
  let tierIdx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (spent >= TIERS[i].minSpend) {
      tier = TIERS[i];
      tierIdx = i;
      break;
    }
  }

  const earned = orderTotal != null ? Math.round(orderTotal * (tier.pct / 100) * 100) / 100 : null;
  const nextTier = tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null;

  const formatMoney = (n) =>
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(n);

  return (
    <s-section>
      <div
        style={`
          background: #111827;
          border-radius: 12px;
          padding: 20px 24px;
          color: #f9fafb;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `}
      >
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af;">
              Loyalty Reward
            </div>
            {!loading && earned != null ? (
              <div style={`font-size: 22px; font-weight: 800; color: ${ACCENT}; margin-top: 2px;`}>
                +{formatMoney(earned)} earned
              </div>
            ) : (
              <div style="font-size: 22px; font-weight: 800; color: #9ca3af; margin-top: 2px;">
                Calculating...
              </div>
            )}
            <div style="font-size: 13px; color: #d1d5db; margin-top: 4px;">
              {tier.pct}% cashback as <strong style={`color: ${TIER_COLORS[tierIdx]};`}>{tier.name}</strong> tier member
            </div>
          </div>

          {nextTier && (
            <div style="text-align: right;">
              <div style="font-size: 11px; color: #9ca3af;">
                {formatMoney(Math.max(0, nextTier.minSpend - spent))} to {nextTier.name}
              </div>
              <div style="font-size: 13px; color: #d1d5db;">
                Unlock {nextTier.pct}% cashback
              </div>
            </div>
          )}
        </div>

        {/* Mini tier bar */}
        <div style="display: flex; gap: 4px; margin-top: 16px;">
          {TIERS.map((t, i) => (
            <div
              key={t.name}
              style={`
                flex: 1;
                height: 4px;
                border-radius: 2px;
                background: ${i <= tierIdx ? TIER_COLORS[i] : '#374151'};
              `}
            ></div>
          ))}
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          {TIERS.map((t, i) => (
            <div
              key={t.name}
              style={`font-size: 10px; color: ${i <= tierIdx ? TIER_COLORS[i] : '#6b7280'}; font-weight: ${i === tierIdx ? '700' : '400'};`}
            >
              {t.name} {t.pct}%
            </div>
          ))}
        </div>

        <div style="font-size: 11px; color: #6b7280; margin-top: 12px;">
          Store credit is applied automatically at checkout.
        </div>
      </div>
    </s-section>
  );
}
