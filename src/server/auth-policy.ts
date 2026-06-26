export type AuthRuntimeMode = "clerk" | "demo-open" | "blocked";

export interface AuthRuntimeReport {
  mode: AuthRuntimeMode;
  configured: boolean;
  required: boolean;
  detail: string;
}

type AuthEnv = Partial<Record<
  "NODE_ENV" | "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" | "CLERK_SECRET_KEY" | "SCALY_AUTH_MODE",
  string
>>;

export function isClerkConfigured(env: AuthEnv = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
}

export function isAuthRequired(env: AuthEnv = process.env): boolean {
  if (env.SCALY_AUTH_MODE === "demo-open") return false;
  if (env.SCALY_AUTH_MODE === "required") return true;
  return env.NODE_ENV === "production";
}

export function authRuntimeMode(env: AuthEnv = process.env): AuthRuntimeReport {
  const configured = isClerkConfigured(env);
  const required = isAuthRequired(env);

  if (configured) {
    return {
      mode: "clerk",
      configured,
      required,
      detail: "Clerk est configuré; les routes applicatives exigent une session.",
    };
  }

  if (required) {
    return {
      mode: "blocked",
      configured,
      required,
      detail: "Authentification requise, mais les clés Clerk sont absentes.",
    };
  }

  return {
    mode: "demo-open",
    configured,
    required,
    detail: "Mode démo locale ouvert; ne pas utiliser pour un pilote client réel.",
  };
}

export function shouldBlockWithoutAuthConfig(env: AuthEnv = process.env, isPublicRoute: boolean): boolean {
  return authRuntimeMode(env).mode === "blocked" && !isPublicRoute;
}
