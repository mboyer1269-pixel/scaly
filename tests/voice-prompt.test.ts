/**
 * Le prompt système de l'agente temps réel est un GARDE-FOU, pas de la prose :
 * chaque règle produit (divulgation IA, interdits, transfert, consentement de
 * rappel ADR-015) doit être présente et vérifiable.
 */
import { describe, expect, it } from "vitest";
import { buildRealtimePrompt, speakablePhone } from "@/services/voice-prompt";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { getScriptById } from "@/data/industry-scripts";
import type { CallerMemory } from "@/domain/caller";

const company = SEED_COMPANIES[0];
const agent = SEED_AGENTS.find((a) => a.companyId === company.id)!;
const script = getScriptById(agent.qualificationScriptId)!;
const prompt = buildRealtimePrompt({ company, agent, script });

describe("speakablePhone", () => {
  it("formate un numéro nord-américain pour la voix, refuse le reste", () => {
    expect(speakablePhone("+18194211269")).toBe("819 421-1269");
    expect(speakablePhone("819-421-1269")).toBe("819 421-1269");
    expect(speakablePhone("anonymous")).toBeNull();
    expect(speakablePhone("inconnu")).toBeNull();
    expect(speakablePhone(undefined)).toBeNull();
  });
});

describe("buildRealtimePrompt", () => {
  it("est déterministe", () => {
    expect(buildRealtimePrompt({ company, agent, script })).toBe(prompt);
  });

  it("divulgue que l'agente est une IA (non négociable)", () => {
    expect(prompt).toContain("assistante virtuelle (IA)");
    expect(prompt).toContain("jamais te faire passer pour un humain");
  });

  it("porte l'identité réelle : agente, entreprise, ville, numéro de transfert", () => {
    expect(prompt).toContain(agent.displayName);
    expect(prompt).toContain(company.name);
    expect(prompt).toContain(company.city);
    expect(prompt).toContain(company.transferPhone);
  });

  it("contient les accueils FR et EN et le bilinguisme — l'accueil de l'AGENT (configurable) prime", () => {
    expect(prompt).toContain("français québécois");
    expect(prompt).toContain("bascule IMMÉDIATEMENT en anglais");
    expect(prompt).toContain(agent.greetingScript.replace(/\{company\}/g, company.name).replace(/\{agent\}/g, agent.displayName));
    expect(prompt).toContain(script.greetingEn.replace(/\{company\}/g, company.name).replace(/\{agent\}/g, agent.displayName));
  });

  it("prononciation : noms propres à la française (sobre, données du tenant)", () => {
    expect(prompt).toContain("# Prononciation");
    expect(prompt).toContain("jamais à l'anglaise");
    expect(prompt).toContain(company.city);
  });

  it("liste chaque question de qualification avec son statut requis/optionnel", () => {
    for (const q of script.questions) {
      expect(prompt).toContain(q.question);
    }
    expect(prompt).toContain("(requis)");
  });

  it("personnalité : empathie avant procédure, répondre aux questions, présence vocale QC", () => {
    expect(prompt).toContain("L'ÉMOTION AVANT LA PROCÉDURE");
    expect(prompt).toContain("RÉPONDS AUX QUESTIONS");
    expect(prompt).toContain("sourire dans la voix");
  });

  it("avec le numéro de l'afficheur : CONFIRMER le numéro, jamais le faire dicter — y compris DANS la liste de questions", () => {
    const withCaller = buildRealtimePrompt({ company, agent, script, callerNumber: "+18194211269" });
    expect(withCaller).toContain("819 421-1269");
    expect(withCaller).toContain("NE lui demande JAMAIS de dicter son numéro");
    // La question « dictez votre numéro » est REMPLACÉE dans la liste (le modèle suit la liste).
    expect(withCaller).not.toContain("Quel est le meilleur numéro pour vous rejoindre");
    expect(withCaller).toContain("DÉJÀ CONNU par l'afficheur");
    // Sans afficheur exploitable : dictée classique, pas de mention d'afficheur.
    expect(buildRealtimePrompt({ company, agent, script, callerNumber: "anonymous" })).not.toContain("afficheur");
    expect(prompt).toContain("Quel est le meilleur numéro pour vous rejoindre");
  });

  it("anti-hallucination : aucun dossier prétendu ; « comme d'habitude » interdit sans dossier client", () => {
    expect(prompt).toContain("Tu n'as AUCUNE information sur l'appelant");
    expect(prompt).toContain("comme d'habitude");
    expect(prompt).not.toContain("Dossier client");
  });

  it("dossier client : historique, champs confirmés, suivi ouvert et règles strictes", () => {
    const callerMemory: CallerMemory = {
      callCount: 2,
      firstCallAt: "2026-06-07",
      lastCallAt: "2026-06-11",
      name: "Richard Ballonnet",
      address: "5291 chemin du Lac-Héduc, Montpellier",
      phoneConfirmed: true,
      recentCalls: [
        {
          date: "2026-06-11",
          intent: "demande_soumission",
          summary: "Remplacement toiture bungalow, client dispo le matin.",
          finalStatus: "suivi_requis",
          hasPendingFollowUp: true,
        },
        {
          date: "2026-06-07",
          intent: "urgence",
          summary: "Infiltration d'eau au sous-sol.",
          finalStatus: "transfere",
          hasPendingFollowUp: false,
        },
      ],
      confirmedFields: {
        nom: "Richard Ballonnet",
        adresse: "5291 chemin du Lac-Héduc, Montpellier",
      },
      hasPendingFollowUp: true,
    };
    const known = buildRealtimePrompt({ company, agent, script, callerNumber: "+18194211269", callerMemory });

    // Structure du dossier
    expect(known).toContain("Dossier client (données RÉELLES");
    expect(known).toContain("Richard Ballonnet");
    expect(known).toContain("5291 chemin du Lac-Héduc");

    // Historique
    expect(known).toContain("Demande de soumission");
    expect(known).toContain("Suivi requis");
    expect(known).toContain("Urgence");
    expect(known).toContain("Transféré");

    // Suivi ouvert
    expect(known).toContain("Suivi ouvert");
    expect(known).toContain("Remplacement toiture bungalow");

    // Règles anti-hallucination
    expect(known).toContain("prends sa version");
    expect(known).toContain("Ne jamais inférer");
    expect(known).toContain("dans notre dossier");
  });

  it("dossier client : question déjà connue au dossier → CONFIRMÉE dans la liste, jamais redemandée", () => {
    const callerMemory: CallerMemory = {
      callCount: 1,
      firstCallAt: "2026-06-07",
      lastCallAt: "2026-06-07",
      name: "Marie Coulombe",
      address: "99 rang des Bouleaux, Gatineau",
      phoneConfirmed: true,
      recentCalls: [],
      confirmedFields: {
        nom: "Marie Coulombe",
        adresse: "99 rang des Bouleaux, Gatineau",
        description: "Inspection et réparation de toiture après tempête.",
      },
      hasPendingFollowUp: false,
    };
    const known = buildRealtimePrompt({ company, agent, script, callerNumber: "+18194211269", callerMemory });

    // Les champs connus doivent porter la mention DÉJÀ AU DOSSIER dans la liste de questions
    expect(known).toContain("DÉJÀ AU DOSSIER");
    expect(known).toContain("99 rang des Bouleaux");
    // La question brute « Quel est votre adresse » ne doit plus apparaître
    const adresseQuestion = script.questions.find((q) => q.fieldKey === "adresse");
    if (adresseQuestion?.question) {
      expect(known).not.toContain(adresseQuestion.question);
    }
  });

  it("inclut les critères d'urgence et le fast-track critique", () => {
    expect(prompt).toContain("dégât d'eau");
    expect(prompt).toContain("fast-track");
  });

  it("rend le transfert humain non négociable", () => {
    expect(prompt).toContain("transfert IMMÉDIAT");
  });

  it("liste les phrases interdites et les règles de sécurité", () => {
    for (const f of script.forbiddenPhrases.slice(0, 3)) {
      expect(prompt).toContain(f);
    }
    expect(prompt).toContain("carte de crédit");
  });

  it("exige le consentement de rappel avec réponse verbatim (ADR-015)", () => {
    expect(prompt).toContain("Consentement de rappel");
    expect(prompt).toContain("êtes-vous d'accord qu'on vous rappelle");
    expect(prompt).toContain("réponse EXACTE");
  });

  it("bascule la consigne de consentement en anglais pour une entreprise anglophone", () => {
    const en = buildRealtimePrompt({ company: { ...company, defaultLanguage: "en" }, agent, script });
    expect(en).toContain("are you okay with us calling or texting you back");
  });
});
