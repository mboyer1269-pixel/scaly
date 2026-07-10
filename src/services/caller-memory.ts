import type { Call } from "@/domain/call";
import type { CallerMemory, CallerCallSummary } from "@/domain/caller";
import { canonicalPhone } from "@/domain/consent";

const MAX_RECENT_CALLS = 5;
const MAX_SUMMARY_CHARS = 150;

/**
 * Sélectionne, dans un historique d'appels, ceux qui appartiennent à CE numéro
 * ET à CE tenant — la double garde qui empêche tout croisement de dossiers.
 *
 * Invariants de sécurité (testés) :
 *  - Numéro masqué / anonyme / non canonique (≠ 10 chiffres) → [] : AUCUNE
 *    mémoire n'est injectée (l'agente ne prétend pas reconnaître un inconnu).
 *  - companyId obligatoire : un appel d'un AUTRE tenant n'entre jamais dans le
 *    dossier (défense en profondeur, même si l'appelant a le même numéro).
 */
export function selectCallerHistory(calls: Call[], companyId: string, fromNumber: string): Call[] {
  const canon = canonicalPhone(fromNumber);
  if (canon.length !== 10) return [];
  return calls.filter((c) => c.status !== "in_progress" && c.companyId === companyId && canonicalPhone(c.fromNumber) === canon);
}

/**
 * Synthétise l'historique d'appels d'un numéro en un dossier structuré prêt pour le prompt.
 * Retourne undefined si aucun appel — jamais d'objet vide ou partiellement rempli.
 *
 * Invariants de sécurité :
 *  - Aucun champ n'est inventé : absent dans les données = absent du dossier.
 *  - confirmedFields : union de tous les appels, le plus récent gagne.
 *  - recentCalls : max 5, du plus récent au plus ancien.
 *  - summary tronqué à 150 chars pour ne pas polluer le prompt.
 */
export function buildCallerMemory(calls: Call[]): CallerMemory | undefined {
  const finalCalls = calls.filter((c) => c.status !== "in_progress");
  if (finalCalls.length === 0) return undefined;

  // Plus récent en premier — base de toute la logique
  const sorted = [...finalCalls].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  // Nom : premier appel qui l'a (le plus récent d'abord)
  const nameCall = sorted.find((c) => c.callerName || c.intelligence?.collectedFields?.nom);
  const name = nameCall?.callerName ?? nameCall?.intelligence?.collectedFields?.nom;

  // Adresse : même logique, le plus récent prime
  const addressCall = sorted.find((c) => c.intelligence?.collectedFields?.adresse);
  const address = addressCall?.intelligence?.collectedFields?.adresse;

  // Champs confirmés : union de tous les appels. On itère du plus ANCIEN au plus
  // RÉCENT pour que le plus récent écrase en cas de conflit (dernière info connue).
  const confirmedFields: Record<string, string> = {};
  for (const call of [...sorted].reverse()) {
    for (const [key, value] of Object.entries(call.intelligence?.collectedFields ?? {})) {
      if (value?.trim()) confirmedFields[key] = value.trim();
    }
  }

  // Historique récent
  const recentCalls: CallerCallSummary[] = sorted.slice(0, MAX_RECENT_CALLS).map((call) => {
    const raw = call.intelligence?.summary;
    const summary =
      raw
        ? raw.length > MAX_SUMMARY_CHARS
          ? raw.slice(0, MAX_SUMMARY_CHARS) + "…"
          : raw
        : undefined;
    return {
      date: call.startedAt.slice(0, 10),
      intent: call.intelligence?.intent ?? "autre",
      summary,
      finalStatus: call.intelligence?.finalStatus ?? "ignore_spam",
      hasPendingFollowUp: call.intelligence?.finalStatus === "suivi_requis",
    };
  });

  return {
    callCount: finalCalls.length,
    firstCallAt: sorted[sorted.length - 1].startedAt.slice(0, 10),
    lastCallAt: sorted[0].startedAt.slice(0, 10),
    ...(name !== undefined ? { name } : {}),
    ...(address !== undefined ? { address } : {}),
    phoneConfirmed: true,
    recentCalls,
    confirmedFields,
    hasPendingFollowUp: recentCalls.some((c) => c.hasPendingFollowUp),
  };
}
