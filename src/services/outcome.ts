import type { Call } from "@/domain/call";

export interface OutcomeValidation {
  valid: boolean;
  reason: string;
}

export function validateCallOutcome(call: Call): OutcomeValidation {
  const intelligence = call.intelligence;
  if (!intelligence) {
    return { valid: false, reason: "Aucun résultat d'intelligence ni échec explicite n'est enregistré." };
  }

  if (call.status === "transferred") {
    return { valid: true, reason: "Transfert humain demandé." };
  }

  if (intelligence.intent === "spam" || intelligence.finalStatus === "ignore_spam") {
    return { valid: true, reason: "Spam rejeté." };
  }

  if (intelligence.finalStatus === "resolu_par_ia") {
    return { valid: true, reason: "Demande résolue avec les informations approuvées." };
  }

  if (intelligence.finalStatus === "suivi_requis" && intelligence.nextAction !== "aucune") {
    return { valid: true, reason: "Suivi concret enregistré." };
  }

  if (intelligence.finalStatus === "perdu" || call.status === "abandoned") {
    return { valid: true, reason: "Échec explicite enregistré pour révision." };
  }

  return { valid: false, reason: "La conversation est terminée sans résultat autorisé." };
}
