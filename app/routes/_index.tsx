import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  // Preserve any query parameters (Shopify passes session tokens etc.)
  return redirect(`/app${url.search}`);
};
