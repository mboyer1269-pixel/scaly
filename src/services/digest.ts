/**
 * Service — Pouls quotidien par texto + dialogue propriétaire (P3.2).
 * Fonctions PURES : le propriétaire vit dans ses textos, pas dans un dashboard.
 *  - buildDailyDigest : « Aujourd'hui : 3 chauds (4 100 $), 1 mécontent, 2 sauvés »
 *  - answerOwnerKeyword : répondre au texto = parler à sa réceptionniste.
 *    v1 DÉTERMINISTE par mots-clés (zéro hallucination, zéro coût) ;
 *    v2 conversationnelle (LLM) viendra par-dessus la même interface.
 */
import type { Call } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import type { Company } from "@/domain/company";
import { computeRescueQueue } from "./rescue";
import { formatCad } from "@/lib/format";

export interface DailyDigest {
  date: string; // YYYY-MM-DD
  hotCount: number;
  hotValueCad: number;
  unhappyCount: number;
  savedCount: number;
  savedValueCad: number;
  rescueCount: number;
  rescueValueCad: number;
  missedCount: number;
  /** Le texto, prêt à partir (< ~480 caractères, 3 segments SMS max). */
  smsText: string;
}

function isSameLocalDay(iso: string, ref: Date, timeZone = "America/Toronto"): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date(iso)) === fmt.format(ref);
}

/** Pouls du jour (heure locale America/Toronto). */
export function buildDailyDigest(company: Company, calls: Call[], actions: ScalyAction[], now = new Date()): DailyDigest {
  const today = calls.filter((c) => isSameLocalDay(c.startedAt, now));
  const hot = today.filter((c) => c.intelligence?.leadQuality === "chaud" && c.intelligence.finalStatus === "suivi_requis");
  const hotValueCad = hot.reduce((s, c) => s + (c.intelligence?.estimatedValueCad ?? 0), 0);
  const unhappy = today.filter((c) => c.intelligence?.intent === "plainte" || c.intelligence?.sentiment === "negatif");
  const saved = today.filter((c) => c.intelligence?.saved);
  const savedValueCad = saved.reduce((s, c) => s + (c.intelligence?.estimatedValueCad ?? 0), 0);
  const missed = today.filter((c) => c.status === "missed");
  const rescue = computeRescueQueue(company, calls, actions, now);
  const rescueValueCad = rescue.reduce((s, e) => s + e.valueAtRiskCad, 0);

  const lines: string[] = [`${company.name} — votre téléphone aujourd'hui :`];
  lines.push(`🔥 ${hot.length} client${hot.length > 1 ? "s" : ""} chaud${hot.length > 1 ? "s" : ""}${hot.length ? ` (${formatCad(hotValueCad)})` : ""}`);
  lines.push(`😠 ${unhappy.length} mécontent${unhappy.length > 1 ? "s" : ""}${unhappy.length ? " à rappeler en priorité" : ""}`);
  lines.push(`✅ ${saved.length} appel${saved.length > 1 ? "s" : ""} sauvé${saved.length > 1 ? "s" : ""}${saved.length ? ` (${formatCad(savedValueCad)} protégés)` : ""}`);
  if (rescue.length > 0) lines.push(`⏱ ${rescue.length} à sauver maintenant (${formatCad(rescueValueCad)} en jeu)`);
  lines.push(`Répondez CHAUDS, MÉCONTENTS, À SAUVER ou RÉSUMÉ.`);

  return {
    date: now.toISOString().slice(0, 10),
    hotCount: hot.length,
    hotValueCad,
    unhappyCount: unhappy.length,
    savedCount: saved.length,
    savedValueCad,
    rescueCount: rescue.length,
    rescueValueCad,
    missedCount: missed.length,
    smsText: lines.join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Dialogue propriétaire par mots-clés (v1 déterministe)
// ---------------------------------------------------------------------------

export type OwnerKeyword = "CHAUDS" | "MECONTENTS" | "A_SAUVER" | "RESUME" | "AIDE";

/** Normalise le texto reçu : accents, casse, espaces. Inconnu → AIDE. */
export function parseOwnerKeyword(text: string): OwnerKeyword {
  const t = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (/^CHAUD/.test(t)) return "CHAUDS";
  if (/^MECONTENT/.test(t)) return "MECONTENTS";
  if (/^(A ?SAUVER|SAUVER|RESCUE)/.test(t)) return "A_SAUVER";
  if (/^(RESUME|POULS|BILAN|SUMMARY)/.test(t)) return "RESUME";
  return "AIDE";
}

function callLine(c: Call): string {
  const who = c.callerName ?? c.fromNumber;
  const value = c.intelligence?.estimatedValueCad ? ` (${formatCad(c.intelligence.estimatedValueCad)})` : "";
  const what = c.intelligence?.summary?.slice(0, 60) ?? "";
  return `• ${who}${value} — ${what} → ${c.fromNumber}`;
}

/** Répond au texto du propriétaire. Déterministe, basé sur les données du store. */
export function answerOwnerKeyword(keyword: OwnerKeyword, company: Company, calls: Call[], actions: ScalyAction[], now = new Date()): string {
  switch (keyword) {
    case "CHAUDS": {
      const hot = calls
        .filter((c) => c.intelligence?.leadQuality === "chaud" && c.intelligence.finalStatus === "suivi_requis")
        .sort((a, b) => (b.intelligence?.estimatedValueCad ?? 0) - (a.intelligence?.estimatedValueCad ?? 0))
        .slice(0, 3);
      if (hot.length === 0) return "Aucun client chaud en attente. 👍";
      return `${hot.length} client(s) chaud(s) à rappeler :\n${hot.map(callLine).join("\n")}`;
    }
    case "MECONTENTS": {
      const unhappy = calls
        .filter((c) => c.intelligence?.intent === "plainte" || c.intelligence?.sentiment === "negatif")
        .slice(0, 3);
      if (unhappy.length === 0) return "Aucun client mécontent. 👍";
      return `${unhappy.length} client(s) à rappeler en priorité :\n${unhappy.map(callLine).join("\n")}`;
    }
    case "A_SAUVER": {
      const rescue = computeRescueQueue(company, calls, actions, now).slice(0, 3);
      if (rescue.length === 0) return "Aucun appel à sauver — tout est répondu ou récupéré. 💪";
      return `${rescue.length} appel(s) à sauver :\n${rescue
        .map((e) => `• ${e.call.callerName ?? e.call.fromNumber} (${formatCad(e.valueAtRiskCad)}, il y a ${e.minutesSinceCall} min) → ${e.call.fromNumber}`)
        .join("\n")}`;
    }
    case "RESUME":
      return buildDailyDigest(company, calls, actions, now).smsText;
    case "AIDE":
      return "Allô Maude — répondez :\nCHAUDS = leads à rappeler\nMÉCONTENTS = clients à risque\nÀ SAUVER = appels manqués récupérables\nRÉSUMÉ = pouls du jour";
  }
}
