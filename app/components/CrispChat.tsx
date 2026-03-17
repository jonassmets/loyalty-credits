import { useEffect } from "react";

const CRISP_WEBSITE_ID = "a729f784-5177-433b-bd89-0addbf7e28c7";

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
