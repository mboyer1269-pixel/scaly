/**
 * Prompt système de l'agente temps réel (P2B).
 * Construit depuis les MÊMES objets que le simulateur et le Voice Lab
 * (Company + VoiceAgentConfig + IndustryScript) — c'est voulu : une seule
 * source de vérité comportementale, du lab au téléphone.
 *
 * Déterministe et testé (tests/voice-prompt.test.ts) : divulgation IA,
 * phrases interdites, règles de transfert, bilinguisme, consentement de
 * rappel (ADR-015) — chaque garde-fou est vérifiable.
 */
import type { Company } from "@/domain/company";
import type { VoiceAgentConfig } from "@/domain/agent";
import type { IndustryScript } from "@/domain/script";
import { FIELD_LABELS } from "@/domain/script";

export interface RealtimePromptContext {
  company: Company;
  agent: VoiceAgentConfig;
  script: IndustryScript;
}

export function buildRealtimePrompt({ company, agent, script }: RealtimePromptContext): string {
  const lines: string[] = [];
  const fr = company.defaultLanguage === "fr";

  // --- Identité et divulgation IA (non négociable) ---
  lines.push(`# Identité`);
  lines.push(
    `Tu es ${agent.displayName}, l'assistante virtuelle (IA) de ${company.name} à ${company.city}. ` +
      `Tu réponds au téléphone. Tu t'annonces TOUJOURS comme assistante virtuelle dès l'accueil — jamais te faire passer pour un humain.`,
  );
  lines.push(`Personnalité : ${agent.persona} Style : ${agent.style}`);

  // --- Langue ---
  lines.push(`# Langue`);
  lines.push(
    fr
      ? `Langue par défaut : français québécois, vouvoiement. Si l'appelant parle anglais, bascule IMMÉDIATEMENT en anglais et continue dans sa langue. S'il revient au français, suis-le. Réponds toujours dans la langue du dernier tour de l'appelant.`
      : `Default language: English. If the caller speaks French, switch immediately and continue in French. Always reply in the language of the caller's last turn.`,
  );

  // --- Accueil ---
  lines.push(`# Accueil`);
  lines.push(`FR : « ${script.greeting.replace(/\{company\}/g, company.name).replace(/\{agent\}/g, agent.displayName)} »`);
  lines.push(`EN : « ${script.greetingEn.replace(/\{company\}/g, company.name).replace(/\{agent\}/g, agent.displayName)} »`);

  // --- Mission : qualification ---
  lines.push(`# Mission — qualifier l'appel`);
  lines.push(`Collecte ces informations, UNE question à la fois, dans l'ordre, sans interrogatoire (conversationnel) :`);
  for (const q of script.questions) {
    lines.push(`- ${FIELD_LABELS[q.fieldKey]}${q.required ? " (requis)" : " (optionnel)"} — FR : « ${q.question} »${q.questionEn ? ` / EN : « ${q.questionEn} »` : ""}`);
  }
  lines.push(`Si une réponse contredit une information déjà donnée, clarifie tout de suite — ne devine jamais.`);

  // --- Urgences ---
  lines.push(`# Urgences`);
  for (const c of script.urgencyCriteria) {
    lines.push(`- Niveau ${c.level} si tu entends : ${c.keywords.join(", ")} (${c.note}).`);
  }
  lines.push(
    `Urgence critique = fast-track : confirme SEULEMENT l'adresse et le numéro de rappel, annonce le transfert à l'équipe de garde, puis transfère. Pas de qualification complète.`,
  );

  // --- Transfert humain ---
  lines.push(`# Transfert humain (règles non négociables)`);
  lines.push(`- L'appelant demande un humain → transfert IMMÉDIAT au ${company.transferPhone}. Jamais d'insistance.`);
  lines.push(`- Frustration ou colère → propose le transfert sans te justifier.`);
  for (const t of script.transferCriteria) {
    lines.push(`- ${t.condition}`);
  }
  lines.push(`Politique de l'entreprise : ${agent.transferPolicy}`);

  // --- Objections ---
  if (script.commonObjections.length > 0) {
    lines.push(`# Objections fréquentes`);
    for (const o of script.commonObjections) {
      lines.push(`- « ${o.objection} » → ${o.response}`);
    }
  }

  // --- Interdictions ---
  lines.push(`# Interdictions strictes`);
  for (const r of agent.safetyRules) lines.push(`- ${r}`);
  for (const l of agent.answerLimits) lines.push(`- ${l}`);
  const forbidden = [...new Set([...script.forbiddenPhrases, ...agent.forbiddenPhrases])];
  if (forbidden.length > 0) {
    lines.push(`Ne prononce JAMAIS ces phrases ou équivalents : ${forbidden.map((f) => `« ${f} »`).join(", ")}.`);
  }
  lines.push(`Sollicitation commerciale (SEO, télémarketing…) → refuse poliment et termine l'appel.`);

  // --- Consentement de rappel (ADR-015 — relance conforme par conception) ---
  lines.push(`# Consentement de rappel (obligatoire avant de clore)`);
  lines.push(
    fr
      ? `Avant le récapitulatif, demande : « Si on n'arrive pas à vous joindre, êtes-vous d'accord qu'on vous rappelle ou qu'on vous texte à ce numéro ? » Note la réponse EXACTE de l'appelant. S'il refuse, n'insiste pas et note le refus.`
      : `Before the recap, ask: "If we can't reach you, are you okay with us calling or texting you back at this number?" Note the caller's EXACT answer. If they decline, do not insist and note the refusal.`,
  );

  // --- Clôture ---
  lines.push(`# Clôture`);
  lines.push(`Récapitule la demande (besoin, adresse si pertinente, moment, numéro de rappel), confirme avec l'appelant, puis conclus : « ${agent.closingScript} »`);
  lines.push(`Reste bref à chaque tour : 1 à 2 phrases, c'est un appel téléphonique, pas un courriel.`);

  return lines.join("\n");
}
