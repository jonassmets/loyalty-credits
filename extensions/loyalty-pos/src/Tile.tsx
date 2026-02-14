import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<LoyaltyTile />, document.body);
};

function LoyaltyTile() {
  const [isDisabled, setIsDisabled] = useState(false);
  const [subheading, setSubheading] = useState("Store Credit");

  useEffect(() => {
    // Subscribe to cart changes to show customer loyalty balance in subheading
    const unsubscribe = shopify.cart.subscribe(async (cart) => {
      if (cart.customer?.id) {
        try {
          const res = await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            body: JSON.stringify({
              query: `query GetCustomerLoyalty($id: ID!) {
                customer(id: $id) {
                  totalEarned: metafield(namespace: "$app", key: "loyalty_total_earned") { value }
                }
              }`,
              variables: { id: `gid://shopify/Customer/${cart.customer.id}` },
            }),
          });
          const data = await res.json();
          const totalEarned = data?.data?.customer?.totalEarned?.value;
          if (totalEarned) {
            setSubheading(`Balance: ${parseFloat(totalEarned).toFixed(0)} EUR`);
          } else {
            setSubheading("Store Credit");
          }
        } catch {
          setSubheading("Store Credit");
        }
      } else {
        setSubheading("Store Credit");
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = shopify.connectivity.current.subscribe((connectivity) => {
      setIsDisabled(connectivity.internetConnected !== "Connected");
    });
    return unsubscribe;
  }, []);

  return (
    <s-tile
      heading="Loyalty"
      subheading={subheading}
      disabled={isDisabled}
      onClick={() => shopify.action.presentModal()}
    />
  );
}
