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
    if (error instanceof Response) {
      throw error; // Re-throw Response objects (410 bounce, redirects, etc.)
    }
    // Store the error for debugging
    (globalThis as any).__lastAppError = {
      message: (error as Error).message,
      stack: (error as Error).stack?.split("\n").slice(0, 8),
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

  // Handle auth bounce (410) and other expected Shopify responses
  // The @shopify/shopify-app-react-router boundary expects ErrorResponse/ErrorResponseImpl
  // but React Router v7 uses RouteErrorResponse, so we handle it directly
  if (isRouteErrorResponse(error)) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: error.data || "Handling response" }}
      />
    );
  }

  // For unexpected errors, try the Shopify boundary, then fall back
  try {
    return boundary.error(error);
  } catch {
    throw error;
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
