/**
 * Golden set — annotations HUMAINES des 53 appels seed (intention + urgence).
 * C'est le jeu d'évaluation des moteurs d'intelligence (ROADMAP P1, critère
 * de sortie : ≥ 90 % d'accord intention ET urgence).
 *
 * RÈGLES D'ANNOTATION (documentées pour la reproductibilité) :
 * - Annoté à l'aveugle depuis les transcripts bruts (scripts/dump-golden-transcripts.ts),
 *   sans regarder la sortie de rules-v1.
 * - intent : la raison d'appel dominante du point de vue de l'appelant.
 * - urgency : critique = risque immédiat (dégât actif, douleur aiguë) ;
 *   haute = à traiter le jour même (plainte, panne bloquante) ;
 *   normale = demande standard ; basse = spam/sollicitation.
 * - Appels manqués (transcript vide) : intent "autre", urgency "normale"
 *   (aucun contenu à classifier — la valeur à risque est gérée en analytics).
 *
 * Les IDs d'appels simulés ne sont pas déterministes : l'ancrage se fait par
 * identité de génération stable via goldenKey().
 */
import type { Call, Intent, Urgency } from "@/domain/call";

/** Clé stable d'un appel seed, indépendante des IDs générés. */
export function goldenKey(call: Pick<Call, "id" | "source" | "companyId" | "scriptId" | "personaId" | "seed">): string {
  if (call.source === "seed_curated") return `curated:${call.id}`;
  return `sim:${call.companyId}|${call.scriptId ?? "-"}|${call.personaId ?? "-"}|${call.seed ?? "-"}`;
}

export interface GoldenAnnotation {
  key: string;
  expected: { intent: Intent; urgency: Urgency };
  /** Justification courte de l'annotateur (traçabilité des cas limites). */
  note?: string;
}

export const GOLDEN_ANNOTATIONS: GoldenAnnotation[] = [
  // ---------- Appels curés (compagnie principale, script_domicile) ----------
  {
    key: "curated:call_comp_belair_cur1",
    expected: { intent: "urgence", urgency: "critique" },
    note: "Tuyau éclaté, eau qui monte — dégât actif.",
  },
  {
    key: "curated:call_comp_belair_cur2",
    expected: { intent: "demande_soumission", urgency: "haute" },
    note: "Fuite active mais contenue (bac), remplacement souhaité « asap this week », budget mentionné — soumission prioritaire, pas une urgence vitale.",
  },
  {
    key: "curated:call_comp_belair_cur3",
    expected: { intent: "plainte", urgency: "haute" },
    note: "Deux rappels ignorés, menace d'aller ailleurs aujourd'hui.",
  },
  {
    key: "curated:call_comp_belair_cur4",
    expected: { intent: "demande_soumission", urgency: "normale" },
    note: "Magasinage de prix explicite, « pas pressée ».",
  },
  // Appels manqués : transcript vide → rien à classifier (règle d'annotation).
  { key: "curated:call_comp_belair_miss1", expected: { intent: "autre", urgency: "normale" } },
  { key: "curated:call_comp_belair_miss2", expected: { intent: "autre", urgency: "normale" } },
  { key: "curated:call_comp_belair_miss3", expected: { intent: "autre", urgency: "normale" } },

  // ---------- Simulés — Plomberie Bélair (script_domicile) ----------
  { key: "sim:comp_belair|script_domicile|persona_magasineur|101", expected: { intent: "demande_soumission", urgency: "normale" } },
  {
    key: "sim:comp_belair|script_domicile|persona_regulier|102",
    expected: { intent: "demande_soumission", urgency: "normale" },
    note: "Services à domicile : demande de travaux = soumission (taxonomie produit), « cette semaine idéalement » = normale.",
  },
  { key: "sim:comp_belair|script_domicile|persona_urgence|103", expected: { intent: "urgence", urgency: "critique" }, note: "Tuyau pété, eau qui monte." },
  {
    key: "sim:comp_belair|script_domicile|persona_presse|104",
    expected: { intent: "demande_soumission", urgency: "normale" },
    note: "Impatience exprimée mais besoin routinier (entretien fournaise) — pas d'urgence métier.",
  },
  { key: "sim:comp_belair|script_domicile|persona_magasineur|105", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_belair|script_domicile|persona_anglophone|106", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_belair|script_domicile|persona_regulier|107", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_belair|script_domicile|persona_spam|108", expected: { intent: "spam", urgency: "basse" } },
  { key: "sim:comp_belair|script_domicile|persona_magasineur|109", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_belair|script_domicile|persona_regulier|110", expected: { intent: "demande_soumission", urgency: "normale" } },
  {
    key: "sim:comp_belair|script_domicile|persona_presse|111",
    expected: { intent: "demande_soumission", urgency: "normale" },
    note: "Refuse de donner ses infos, mais besoin routinier.",
  },
  { key: "sim:comp_belair|script_domicile|persona_urgence|112", expected: { intent: "urgence", urgency: "critique" }, note: "Plus de chauffage à -20 °C, ça empire — risque matériel/santé." },
  { key: "sim:comp_belair|script_domicile|persona_regulier|113", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_belair|script_domicile|persona_magasineur|114", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_belair|script_domicile|persona_spam|115", expected: { intent: "spam", urgency: "basse" } },
  { key: "sim:comp_belair|script_domicile|persona_frustre|116", expected: { intent: "plainte", urgency: "haute" }, note: "Insatisfaction explicite sur service reçu." },

  // ---------- Simulés — Rénovations Rive-Nord (script_construction) ----------
  { key: "sim:comp_rivnord|script_construction|persona_magasineur|200", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_rivnord|script_construction|persona_regulier|201", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_rivnord|script_construction|persona_urgence|202", expected: { intent: "urgence", urgency: "critique" }, note: "Infiltration d'eau active dans le toit." },
  {
    key: "sim:comp_rivnord|script_construction|persona_presse|203",
    expected: { intent: "demande_soumission", urgency: "normale" },
    note: "Pressé mais projet de finition de sous-sol — routinier.",
  },
  { key: "sim:comp_rivnord|script_construction|persona_spam|204", expected: { intent: "spam", urgency: "basse" } },
  { key: "sim:comp_rivnord|script_construction|persona_regulier|205", expected: { intent: "demande_soumission", urgency: "normale" } },

  // ---------- Simulés — Garage MécanoPlus (script_garage) ----------
  {
    key: "sim:comp_mecanoplus|script_garage|persona_magasineur|220",
    expected: { intent: "demande_soumission", urgency: "normale" },
    note: "Compare explicitement les prix (« je compare encore ») — soumission, pas RDV.",
  },
  { key: "sim:comp_mecanoplus|script_garage|persona_regulier|221", expected: { intent: "prise_rdv", urgency: "normale" } },
  {
    key: "sim:comp_mecanoplus|script_garage|persona_urgence|222",
    expected: { intent: "urgence", urgency: "haute" },
    note: "Véhicule immobilisé, besoin aujourd'hui — bloquant sans danger matériel actif.",
  },
  { key: "sim:comp_mecanoplus|script_garage|persona_presse|223", expected: { intent: "prise_rdv", urgency: "normale" }, note: "Impatient mais inspection préventive." },
  { key: "sim:comp_mecanoplus|script_garage|persona_spam|224", expected: { intent: "spam", urgency: "basse" } },
  { key: "sim:comp_mecanoplus|script_garage|persona_regulier|225", expected: { intent: "prise_rdv", urgency: "normale" } },

  // ---------- Simulés — Clinique dentaire Sourire (script_dentiste) ----------
  {
    key: "sim:comp_sourire|script_dentiste|persona_magasineur|240",
    expected: { intent: "demande_soumission", urgency: "normale" },
    note: "Magasine les prix d'un examen (assurances, comparaison).",
  },
  { key: "sim:comp_sourire|script_dentiste|persona_regulier|241", expected: { intent: "prise_rdv", urgency: "normale" } },
  {
    key: "sim:comp_sourire|script_dentiste|persona_urgence|242",
    expected: { intent: "urgence", urgency: "critique" },
    note: "Enflure faciale qui empire — abcès potentiel, jour même obligatoire.",
  },
  { key: "sim:comp_sourire|script_dentiste|persona_presse|243", expected: { intent: "prise_rdv", urgency: "normale" }, note: "Pressé mais nettoyage de routine." },
  { key: "sim:comp_sourire|script_dentiste|persona_spam|244", expected: { intent: "spam", urgency: "basse" } },
  { key: "sim:comp_sourire|script_dentiste|persona_regulier|245", expected: { intent: "prise_rdv", urgency: "normale" } },

  // ---------- Simulés — Immobilier Drouin (script_immobilier) ----------
  { key: "sim:comp_drouin|script_immobilier|persona_magasineur|260", expected: { intent: "demande_soumission", urgency: "normale" } },
  {
    key: "sim:comp_drouin|script_immobilier|persona_regulier|261",
    expected: { intent: "demande_soumission", urgency: "normale" },
    note: "Mandat de vente = évaluation/soumission en immobilier (taxonomie produit).",
  },
  {
    key: "sim:comp_drouin|script_immobilier|persona_urgence|262",
    expected: { intent: "urgence", urgency: "haute" },
    note: "Offre à déposer aujourd'hui, acheteurs concurrents — échéance jour même sans danger matériel.",
  },
  { key: "sim:comp_drouin|script_immobilier|persona_presse|263", expected: { intent: "demande_soumission", urgency: "normale" }, note: "Évaluation gratuite, impatient mais routinier." },
  { key: "sim:comp_drouin|script_immobilier|persona_spam|264", expected: { intent: "spam", urgency: "basse" } },
  { key: "sim:comp_drouin|script_immobilier|persona_regulier|265", expected: { intent: "demande_soumission", urgency: "normale" } },

  // ---------- Simulés — Nettoyage ÉclatNet (script_nettoyage) ----------
  { key: "sim:comp_eclatnet|script_nettoyage|persona_magasineur|280", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_eclatnet|script_nettoyage|persona_regulier|281", expected: { intent: "demande_soumission", urgency: "normale" } },
  {
    key: "sim:comp_eclatnet|script_nettoyage|persona_urgence|282",
    expected: { intent: "urgence", urgency: "haute" },
    note: "Remise des clés demain — échéance ferme sans danger matériel.",
  },
  { key: "sim:comp_eclatnet|script_nettoyage|persona_presse|283", expected: { intent: "demande_soumission", urgency: "normale" }, note: "Pressé mais nettoyage post-construction planifiable." },
  { key: "sim:comp_eclatnet|script_nettoyage|persona_spam|284", expected: { intent: "spam", urgency: "basse" } },
  { key: "sim:comp_eclatnet|script_nettoyage|persona_regulier|285", expected: { intent: "demande_soumission", urgency: "normale" } },

  // ---------- Simulés — Allô Maude Démo (script_domicile) ----------
  { key: "sim:comp_maude|script_domicile|persona_magasineur|300", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_maude|script_domicile|persona_regulier|301", expected: { intent: "demande_soumission", urgency: "normale" } },
  { key: "sim:comp_maude|script_domicile|persona_urgence|302", expected: { intent: "urgence", urgency: "critique" }, note: "Tuyau éclaté, eau active — dégât immédiat." },
  { key: "sim:comp_maude|script_domicile|persona_presse|303", expected: { intent: "demande_soumission", urgency: "haute" }, note: "Routine mais « le plus vite possible » exprimé — urgence de timing déclarée." },
  { key: "sim:comp_maude|script_domicile|persona_spam|304", expected: { intent: "spam", urgency: "basse" } },
  { key: "sim:comp_maude|script_domicile|persona_regulier|305", expected: { intent: "demande_soumission", urgency: "normale" } },
];
