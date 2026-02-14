import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const checks: Record<string, string> = {};

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

  return new Response(JSON.stringify(checks, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};
