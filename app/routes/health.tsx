import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const checks: Record<string, any> = {};

  // Check env vars
  checks.SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY ? "set" : "MISSING";
  checks.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET ? "set" : "MISSING";
  checks.SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || "MISSING";
  checks.DATABASE_URL = process.env.DATABASE_URL ? "set" : "MISSING";
  checks.NODE_ENV = process.env.NODE_ENV || "not set";

  // Check database connection
  try {
    const sessionCount = await prisma.session.count();
    checks.database = `connected (${sessionCount} sessions)`;
  } catch (error: any) {
    checks.database = `ERROR: ${error.message}`;
  }

  // If ?test-auth is set, try to authenticate
  if (url.searchParams.has("test-auth")) {
    try {
      await authenticate.admin(request);
      checks.auth = "success";
    } catch (error: any) {
      if (error instanceof Response) {
        checks.auth = `Response: ${error.status} ${error.statusText}`;
        try {
          const body = await error.clone().text();
          checks.authBody = body.substring(0, 500);
        } catch {}
      } else {
        checks.auth = `Error: ${error.message}`;
        checks.authStack = error.stack?.split("\n").slice(0, 5);
      }
    }
  }

  // Show last captured error
  if (url.searchParams.has("last-error")) {
    checks.lastError = (globalThis as any).__lastAppError || "No errors captured";
  }

  return new Response(JSON.stringify(checks, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};
