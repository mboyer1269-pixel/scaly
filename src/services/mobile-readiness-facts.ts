import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MobileStoreReadinessFacts } from "./mobile-readiness";

export function collectMobileStoreReadinessFacts(root = process.cwd()): MobileStoreReadinessFacts {
  const has = (path: string) => existsSync(join(root, path));
  const read = (path: string) => has(path) ? readFileSync(join(root, path), "utf8") : "";
  const appConfig = read("apps/mobile/app.json");
  const envExample = read("apps/mobile/.env.example");
  const hasSharedBearerAuth = has("src/server/mobile-auth.ts") && has("src/app/api/mobile/v1/overview/route.ts");
  const hasNativeUserAuth = has("apps/mobile/src/auth/session.ts") && has("src/app/api/mobile/v1/me/route.ts");

  return {
    expoProjectConfigured: has("apps/mobile/package.json") && has("apps/mobile/app/_layout.tsx"),
    easConfigured: has("apps/mobile/eas.json"),
    apiBaseUrlConfigured: envExample.includes("EXPO_PUBLIC_API_BASE_URL"),
    mobileAuthModel: hasNativeUserAuth ? "native_user" : hasSharedBearerAuth ? "shared_bearer" : "none",
    accountDeletionPath: has("src/app/api/privacy/delete-account/route.ts") && has("apps/mobile/app/privacy.tsx"),
    privacyExportPath: has("src/app/api/privacy/export/route.ts") && has("src/app/api/mobile/v1/privacy/export/route.ts"),
    storeMetadataPrepared: has("apps/mobile/store/metadata.md"),
    pushNotificationPlan: has("apps/mobile/store/push-notifications.md"),
    deepLinkSchemeConfigured: appConfig.includes('"scheme": "allomaude"'),
  };
}
