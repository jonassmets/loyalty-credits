import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<OrderStatusBlock />, document.body);
};

function OrderStatusBlock() {
  // TODO: Replace with real calculation based on order total and loyalty config
  const earnedCredit = 12.5;
  const tier = "Level 1";

  return (
    <s-banner tone="success">
      <s-stack direction="block" inline-alignment="center">
        <s-text>
          You earned {shopify.i18n.formatCurrency(earnedCredit, { currency: "EUR" })}{" "}
          in store credit from this order ({tier} - 5% back).{" "}
          <s-link>View rewards</s-link>
        </s-text>
      </s-stack>
    </s-banner>
  );
}
