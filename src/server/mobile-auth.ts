import { NextResponse } from "next/server";
import { authRuntimeMode } from "./auth-policy";

export function mobileAuthReport(env = process.env): { configured: boolean; required: boolean; mode: "bearer" | "blocked" | "demo-open" } {
  const configured = Boolean(env.MOBILE_API_BEARER_TOKEN);
  const explicitlyOpenForDemo = env.SCALY_MOBILE_AUTH_MODE === "demo-open";
  const required = !explicitlyOpenForDemo && (
    env.NODE_ENV === "production" ||
    authRuntimeMode(env).mode !== "demo-open" ||
    env.SCALY_MOBILE_AUTH_MODE === "required"
  );
  if (configured) return { configured, required, mode: "bearer" };
  if (required) return { configured, required, mode: "blocked" };
  return { configured, required, mode: "demo-open" };
}

export function requireMobileBearer(req: Request): NextResponse | null {
  const report = mobileAuthReport();
  if (report.mode === "demo-open") return null;
  if (report.mode === "blocked") {
    return NextResponse.json({ error: "MOBILE_API_BEARER_TOKEN requis pour les endpoints mobiles." }, { status: 503 });
  }
  const expected = process.env.MOBILE_API_BEARER_TOKEN;
  const actual = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || actual !== expected) {
    return NextResponse.json({ error: "Bearer token mobile invalide." }, { status: 401 });
  }
  return null;
}
