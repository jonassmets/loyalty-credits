import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let message = "Unknown error";
  let details = "";

  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
    details = typeof error.data === "string" ? error.data : JSON.stringify(error.data);
  } else if (error instanceof Error) {
    message = error.message;
    details = error.stack || "";
  } else {
    message = String(error);
  }

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Error</title>
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1>Application Error</h1>
        <pre style={{ background: "#fee", padding: "1rem", borderRadius: "8px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {message}
        </pre>
        {details && (
          <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "8px", fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {details}
          </pre>
        )}
      </body>
    </html>
  );
}
