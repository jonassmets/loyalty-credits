// @ts-nocheck
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

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

function OrderStatusBlock() {
  return (
    <s-section heading="Loyalty Rewards">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        <s-banner tone="success">
          <s-text>
            You earned store credit on this order! Your cashback is based on
            your spending tier in the last 12 months.
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
      </s-stack>
    </s-section>
  );
}
