export interface MobileStoreReadinessFacts {
  expoProjectConfigured: boolean;
  easConfigured: boolean;
  apiBaseUrlConfigured: boolean;
  mobileAuthModel: "none" | "shared_bearer" | "native_user";
  accountDeletionPath: boolean;
  privacyExportPath: boolean;
  storeMetadataPrepared: boolean;
  pushNotificationPlan: boolean;
  deepLinkSchemeConfigured: boolean;
}

export interface MobileStoreReadinessItem {
  id: string;
  label: string;
  status: "pass" | "fail";
  detail: string;
}

export interface MobileStoreReadinessReport {
  structureReady: boolean;
  readyForStoreSubmission: boolean;
  checks: MobileStoreReadinessItem[];
  storeChecks: MobileStoreReadinessItem[];
  blockers: MobileStoreReadinessItem[];
  storeBlockers: MobileStoreReadinessItem[];
}

function item(id: string, label: string, ok: boolean, pass: string, fail: string): MobileStoreReadinessItem {
  return { id, label, status: ok ? "pass" : "fail", detail: ok ? pass : fail };
}

function authStructureDetail(model: MobileStoreReadinessFacts["mobileAuthModel"]): string {
  if (model === "native_user") return "Auth utilisateur native prévue pour l'app mobile.";
  if (model === "shared_bearer") return "Bearer partagé en place pour pilote interne contrôlé.";
  return "Aucun contrôle d'accès mobile exploitable.";
}

export function evaluateMobileStoreReadiness(facts: MobileStoreReadinessFacts): MobileStoreReadinessReport {
  const checks = [
    item(
      "expo-project",
      "Projet Expo natif",
      facts.expoProjectConfigured,
      "Structure Expo présente.",
      "Aucune structure Expo native exploitable.",
    ),
    item(
      "eas-config",
      "Configuration EAS",
      facts.easConfigured,
      "Profils EAS présents pour development/preview/production.",
      "eas.json absent ou incomplet.",
    ),
    item(
      "api-base-url",
      "API mobile HTTPS",
      facts.apiBaseUrlConfigured,
      "L'app mobile lit une base URL configurable.",
      "L'app mobile ne peut pas cibler une API versionnée/configurable.",
    ),
    item(
      "mobile-auth",
      "Auth mobile",
      facts.mobileAuthModel !== "none",
      authStructureDetail(facts.mobileAuthModel),
      "Aucun contrôle d'accès mobile n'est en place.",
    ),
    item(
      "account-deletion",
      "Suppression de compte",
      facts.accountDeletionPath,
      "Chemin de suppression de compte présent.",
      "Aucun chemin de suppression de compte in-app/web.",
    ),
    item(
      "privacy-export",
      "Export de données",
      facts.privacyExportPath,
      "Export JSON des données de l'entreprise disponible.",
      "Aucun export portable des données utilisateur.",
    ),
    item(
      "store-metadata",
      "Métadonnées stores",
      facts.storeMetadataPrepared,
      "Checklist App Store / Play Store préparée.",
      "Métadonnées, disclosures et assets stores non préparés.",
    ),
    item(
      "push-plan",
      "Plan notifications",
      facts.pushNotificationPlan,
      "Plan de notifications et permissions documenté.",
      "Notifications critiques non planifiées.",
    ),
    item(
      "deep-links",
      "Deep links",
      facts.deepLinkSchemeConfigured,
      "Scheme/deep links configurés.",
      "Aucun scheme mobile pour ouvrir un appel/action.",
    ),
  ];

  const storeChecks = [
    item(
      "native-user-auth",
      "Auth utilisateur native",
      facts.mobileAuthModel === "native_user",
      "Chaque propriétaire est authentifié individuellement dans l'app mobile.",
      "Le bearer partagé suffit pour un pilote interne, mais pas pour une app commerciale multi-client sur stores.",
    ),
  ];

  const blockers = checks.filter((check) => check.status === "fail");
  const storeSpecificBlockers = storeChecks.filter((check) => check.status === "fail");
  const storeBlockers = [...blockers, ...storeSpecificBlockers];
  return {
    structureReady: blockers.length === 0,
    readyForStoreSubmission: storeBlockers.length === 0,
    checks,
    storeChecks,
    blockers,
    storeBlockers,
  };
}
