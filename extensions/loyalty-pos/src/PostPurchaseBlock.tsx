import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<PostPurchaseBlock />, document.body);
};

function PostPurchaseBlock() {
  const [earnedCredit, setEarnedCredit] = useState("0.00");
  const [hasCustomer, setHasCustomer] = useState(false);

  useEffect(() => {
    calculateCredit();
  }, []);

  async function calculateCredit() {
    try {
      const order = shopify.order.current.value;
      if (!order?.customer?.id) {
        setHasCustomer(false);
        return;
      }

      setHasCustomer(true);

      // Calculate estimated credit (5% default - actual credit is processed by webhook)
      const grandTotal = parseFloat(order.grandTotal?.amount || "0");
      const estimated = (grandTotal * 0.05).toFixed(2);
      setEarnedCredit(estimated);
    } catch {
      // Silently fail
    }
  }

  if (!hasCustomer) {
    return (
      <s-section heading="Loyalty Credits">
        <s-text color="subdued">
          No customer was associated with this order. Loyalty credit requires a
          customer account.
        </s-text>
      </s-section>
    );
  }

  return (
    <s-section heading="Loyalty Credits">
      <s-stack direction="block" gap="base">
        <s-text type="strong" tone="success">
          Customer earned ~{earnedCredit} EUR in store credit!
        </s-text>
        <s-text color="subdued">
          Credit is processed automatically and added to the customer's gift card.
        </s-text>
      </s-stack>
    </s-section>
  );
}
