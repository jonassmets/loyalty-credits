import { render } from "preact";

export default async (api) => {
  render(<OrderStatusBlock api={api} />, document.body);
};

function OrderStatusBlock({ api }) {
  return (
    <s-banner tone="success">
      <s-stack direction="block" gap="small">
        <s-text type="strong">
          You earned store credit on this order!
        </s-text>
        <s-text>
          Your cashback is based on your spending tier. The more you shop
          in the last 12 months, the higher your percentage. Credit is
          applied automatically at your next checkout.
        </s-text>
      </s-stack>
    </s-banner>
  );
}
