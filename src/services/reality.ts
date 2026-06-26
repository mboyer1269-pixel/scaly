import type { Call } from "@/domain/call";
import type { ReadinessEvidence, RealityLabel } from "@/domain/readiness";
import type { StoreInfo } from "@/server/store";

const LABELS: Record<RealityLabel["state"], string> = {
  verified: "Vérifié",
  configured_not_verified: "Configuré, non vérifié",
  simulated: "Simulé",
  unavailable: "Indisponible",
};

function label(state: RealityLabel["state"], detail: string): RealityLabel {
  return { state, label: LABELS[state], detail };
}

export function deriveProviderReality(input: {
  configured: boolean;
  verified: boolean;
  detail: string;
}): RealityLabel {
  if (input.verified) return label("verified", input.detail);
  if (input.configured) return label("configured_not_verified", input.detail);
  return label("unavailable", input.detail);
}

export function deriveCallReality(
  call: Call,
  store: StoreInfo,
  evidence?: ReadinessEvidence,
): RealityLabel {
  if (call.source !== "live") {
    return label("simulated", "Appel généré par un scénario contrôlé et conservé dans l'application.");
  }

  const verified =
    store.persistent &&
    evidence?.status === "verified" &&
    evidence.callId === call.id &&
    Boolean(evidence.verifiedAt);

  if (verified) {
    return label("verified", evidence.detail);
  }

  return label(
    "configured_not_verified",
    store.persistent
      ? "Appel marqué live, mais aucune preuve d'exécution externe vérifiée n'est liée."
      : "Appel live conservé en mémoire seulement; la persistance commerciale n'est pas vérifiée.",
  );
}
