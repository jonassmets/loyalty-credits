import { useEffect } from "react";

const CRISP_WEBSITE_ID = "8a3a03a6-873f-4e7a-a8ca-57ee41e7cca8";

export function CrispChat({ shopDomain }: { shopDomain?: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    import("crisp-sdk-web").then(({ Crisp }) => {
      Crisp.configure(CRISP_WEBSITE_ID);

      if (shopDomain) {
        Crisp.user.setNickname(shopDomain);
        Crisp.session.setData({ shop: shopDomain, app: "CreditClub" });
      }
    });
  }, [shopDomain]);

  return null;
}
