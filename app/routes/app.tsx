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
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// Store last error for debugging via /health?last-error
(globalThis as any).__lastAppError = null;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
  } catch (error) {
    if (error instanceof Response) throw error;
    (globalThis as any).__lastAppError = {
      message: (error as Error).message,
      stack: (error as Error).stack?.split("\n").slice(0, 8),
      source: "app.tsx loader",
      time: new Date().toISOString(),
    };
    throw error;
  }
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <ui-nav-menu>
        <Link to="/app" rel="home">Home</Link>
        <Link to="/app/customers">Customers</Link>
      </ui-nav-menu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: error.data || "Handling response" }}
      />
    );
  }

  // Show error details directly — don't use boundary.error() which re-throws
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>App Error</h1>
      <pre style={{ background: "#fee", padding: "1rem" }}>{message}</pre>
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
