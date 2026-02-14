// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(<OrderStatusBlock />, document.body);
};

function OrderStatusBlock() {
  return (
    <s-section heading="Loyalty Rewards">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        <s-banner tone="success">
          <s-text>
            You earned store credit on this order! Your cashback percentage is
            based on your spending in the last 12 months.
          </s-text>
        </s-banner>
        <s-stack direction="inline" gap="base">
          <s-stack direction="block" gap="small">
            <s-text color="subdued">Bronze</s-text>
            <s-text type="strong">5% back</s-text>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text color="subdued">Silver</s-text>
            <s-text type="strong">7% back</s-text>
          </s-stack>
          <s-stack direction="block" gap="small">
            <s-text color="subdued">Gold</s-text>
            <s-text type="strong">10% back</s-text>
          </s-stack>
        </s-stack>
        <s-text color="subdued">
          Store credit is applied automatically at your next checkout.
        </s-text>
      </s-stack>
    </s-section>
  );
}
