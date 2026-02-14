import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Link,
  Outlet,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisENTranslations from "@shopify/polaris/locales/en.json";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={polarisENTranslations}>
        <ui-nav-menu>
          <Link to="/app" rel="home">Dashboard</Link>
          <Link to="/app/tiers">Tiers</Link>
          <Link to="/app/bonuses">Bonuses</Link>
          <Link to="/app/customers">Customers</Link>
          <Link to="/app/activity">Activity</Link>
          <Link to="/app/settings">Settings</Link>
        </ui-nav-menu>
        <Outlet />
      </PolarisAppProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div dangerouslySetInnerHTML={{ __html: error.data || "" }} />
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Something went wrong</h1>
      <pre style={{ background: "#fee", padding: "1rem", borderRadius: "8px" }}>
        {message}
      </pre>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  try {
    return boundary.headers(headersArgs);
  } catch {
    return headersArgs.parentHeaders;
  }
};
