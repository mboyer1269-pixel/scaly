/**
 * Appels curés — 4 conversations rédigées à la main (FR-QC + bascule EN)
 * pour la compagnie principale. Elles passent dans le MÊME moteur d'analyse
 * (rules-v1) que les appels simulés : preuve que l'engine fonctionne sur des
 * transcripts bruts, pas seulement sur ses propres données.
 */
import type { Call, TranscriptTurn } from "@/domain/call";
import type { Company } from "@/domain/company";
import type { IndustryScript } from "@/domain/script";
import { intelligenceEngine } from "@/services/intelligence";

function turns(rows: [speaker: "agent" | "caller", text: string, lang?: "fr" | "en"][]): TranscriptTurn[] {
  let clock = 0;
  return rows.map(([speaker, text, lang]) => {
    const t: TranscriptTurn = { speaker, text, atMs: clock, lang: lang ?? "fr" };
    clock += 4200;
    return t;
  });
}

function dateAt(daysAgo: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function buildCuratedCalls(company: Company, script: IndustryScript): Call[] {
  const calls: Call[] = [];

  // ---------- 1. Urgence inondation à 23 h 47 — appel SAUVÉ hors heures ----------
  const c1: Call = {
    id: `call_${company.id}_cur1`,
    companyId: company.id,
    direction: "inbound",
    status: "completed",
    source: "seed_curated",
    fromNumber: "514-555-0149",
    callerName: "Geneviève Lapointe",
    language: "fr",
    startedAt: dateAt(2, 23, 47).toISOString(),
    durationSec: 96,
    scriptId: script.id,
    transcript: turns([
      ["agent", `Bonjour, vous avez joint ${company.name}. Ici Sophie, l'assistante virtuelle. Est-ce une urgence ou une demande de service régulière ?`],
      ["caller", "C'est une urgence ! J'ai un tuyau qui vient de péter dans le sous-sol, pis l'eau monte vite là !"],
      ["agent", "Je comprends, on s'en occupe tout de suite. Première chose : si c'est sécuritaire, fermez l'entrée d'eau principale. Puis-je avoir votre nom ?"],
      ["caller", "Geneviève Lapointe."],
      ["agent", "Merci Geneviève. Quel est le meilleur numéro pour vous rejoindre ?"],
      ["caller", "Le 514-555-0149."],
      ["agent", "À quelle adresse a-t-on besoin de nous ?"],
      ["caller", "1224 rue De Castille à Laval, proche du boulevard de la Concorde."],
      ["agent", "C'est noté. Est-ce que l'eau monte encore en ce moment ?"],
      ["caller", "J'ai trouvé la valve pis je l'ai fermée, ça s'est calmé. Mais il y a deux pouces d'eau partout."],
      ["agent", "Excellent réflexe. Je classe votre appel en urgence critique : l'équipe de garde est avisée à l'instant et on vous rappelle d'ici quelques minutes pour l'arrivée du plombier. Gardez votre téléphone proche."],
      ["caller", "OK merci, faites vite s'il vous plaît !"],
      ["agent", "C'est déjà en route. Courage Geneviève, à tout de suite."],
    ]),
    recordingUrl: null,
  };
  c1.intelligence = intelligenceEngine.analyze(c1, script, {
    collectedFields: {
      nom: "Geneviève Lapointe",
      telephone: "514-555-0149",
      adresse: "1224 rue De Castille, Laval",
      description: "tuyau éclaté au sous-sol — inondation active, valve fermée",
      moment: "maintenant",
    },
    savedReason: "hors_heures",
  });
  calls.push(c1);

  // ---------- 2. Lead chaud anglophone — bascule FR → EN, montant mentionné ----------
  const c2: Call = {
    id: `call_${company.id}_cur2`,
    companyId: company.id,
    direction: "inbound",
    status: "completed",
    source: "seed_curated",
    fromNumber: "514-555-0171",
    callerName: "Sarah Thompson",
    language: "en",
    startedAt: dateAt(1, 10, 15).toISOString(),
    durationSec: 88,
    scriptId: script.id,
    transcript: turns([
      ["agent", `Bonjour, vous avez joint ${company.name}. Ici Sophie, l'assistante virtuelle. Comment puis-je vous aider ?`],
      ["caller", "Hi, sorry — do you speak English? My water heater is leaking and I think it needs to be replaced.", "en"],
      ["agent", "Of course, I'm happy to continue in English! Is it leaking heavily right now, or a slow drip?", "en"],
      ["caller", "It's a slow drip into the pan, nothing flooding yet.", "en"],
      ["agent", "Good to know — we'll treat it quickly anyway. May I have your name?", "en"],
      ["caller", "Sarah Thompson.", "en"],
      ["agent", "Thanks Sarah. Best number to reach you?", "en"],
      ["caller", "514-555-0171.", "en"],
      ["agent", "And the address for the service call?", "en"],
      ["caller", "210 Lakeshore Drive in Pointe-Claire.", "en"],
      ["agent", "Perfect. When would you like us to come?", "en"],
      ["caller", "As soon as possible this week. I'd also like a quote for a tankless unit — my budget is around $3,500.", "en"],
      ["agent", "Noted! A technician will call you back today to confirm a time slot and prepare the tankless quote. Thanks for calling, Sarah!", "en"],
      ["caller", "Great, thank you so much!", "en"],
    ]),
    recordingUrl: null,
  };
  c2.intelligence = intelligenceEngine.analyze(c2, script, {
    collectedFields: {
      nom: "Sarah Thompson",
      telephone: "514-555-0171",
      adresse: "210 Lakeshore Drive, Pointe-Claire",
      description: "chauffe-eau qui fuit — remplacement + soumission pour unité sans réservoir",
      moment: "cette semaine",
    },
  });
  calls.push(c2);

  // ---------- 3. Plainte — client frustré, conversation à risque ----------
  const c3: Call = {
    id: `call_${company.id}_cur3`,
    companyId: company.id,
    direction: "inbound",
    status: "completed",
    source: "seed_curated",
    fromNumber: "450-555-0118",
    callerName: "Stéphane Dubé",
    language: "fr",
    startedAt: dateAt(3, 14, 30).toISOString(),
    durationSec: 74,
    scriptId: script.id,
    transcript: turns([
      ["agent", `Bonjour, vous avez joint ${company.name}. Ici Sophie, l'assistante virtuelle. Comment puis-je vous aider ?`],
      ["caller", "Oui, bien j'appelle parce que ça fait deux fois que je laisse un message pour la réparation de mon chauffe-eau pis personne ne me rappelle. Je suis vraiment pas content."],
      ["agent", "Je suis sincèrement désolée, monsieur. Vous avez raison d'être déçu, et je vais m'assurer que ça ne tombe pas dans le vide cette fois-ci. Puis-je avoir votre nom ?"],
      ["caller", "Stéphane Dubé."],
      ["agent", "Merci monsieur Dubé. Votre numéro est bien le 450-555-0118 ?"],
      ["caller", "Oui, c'est ça."],
      ["agent", `Je note votre plainte en priorité haute. ${company.ownerName} vous rappelle personnellement aujourd'hui même avant 17 h. Est-ce que ça vous convient ?`],
      ["caller", "Bon, OK. Mais si je n'ai pas de nouvelles aujourd'hui, j'appelle ailleurs."],
      ["agent", "C'est très clair, et c'est noté au dossier. Merci de nous donner la chance de nous reprendre, monsieur Dubé."],
    ]),
    recordingUrl: null,
  };
  c3.intelligence = intelligenceEngine.analyze(c3, script, {
    collectedFields: {
      nom: "Stéphane Dubé",
      telephone: "450-555-0118",
      description: "réparation chauffe-eau — deux messages sans rappel",
    },
  });
  calls.push(c3);

  // ---------- 4. Magasineur — objection prix, lead tiède ----------
  const c4: Call = {
    id: `call_${company.id}_cur4`,
    companyId: company.id,
    direction: "inbound",
    status: "completed",
    source: "seed_curated",
    fromNumber: "438-555-0151",
    callerName: "Annie Girard",
    language: "fr",
    startedAt: dateAt(5, 9, 5).toISOString(),
    durationSec: 69,
    scriptId: script.id,
    transcript: turns([
      ["agent", `Bonjour, vous avez joint ${company.name}. Ici Sophie, l'assistante virtuelle. Comment puis-je vous aider ?`],
      ["caller", "Bonjour, je magasine un peu là — c'est combien chez vous pour un drain français ?"],
      ["agent", "Bonne question ! Le prix dépend de la longueur et de l'accès autour de la maison, alors on fonctionne par soumission gratuite. Je peux prendre quelques informations et un technicien vous donne un prix précis. Votre nom ?"],
      ["caller", "Annie Girard."],
      ["agent", "Merci Annie. Le meilleur numéro pour vous rejoindre ?"],
      ["caller", "438-555-0151."],
      ["agent", "Et le projet, c'est un drain français complet autour de la maison ?"],
      ["caller", "Oui, une maison des années 80, il y a de l'humidité au sous-sol. Mais je veux juste un prix pour comparer, je ne suis pas pressée."],
      ["agent", "Parfait, c'est noté. Un technicien vous rappelle avec une fourchette de prix et les questions à poser aux autres compagnies aussi — comme ça vous comparez les bonnes affaires. Bonne journée Annie !"],
      ["caller", "Ah, c'est bon ça. Merci !"],
    ]),
    recordingUrl: null,
  };
  c4.intelligence = intelligenceEngine.analyze(c4, script, {
    collectedFields: {
      nom: "Annie Girard",
      telephone: "438-555-0151",
      description: "drain français — maison années 80, humidité au sous-sol, magasine les prix",
    },
  });
  calls.push(c4);

  return calls;
}

/** Appels manqués seed (avec et sans récupération SMS). */
export function buildMissedCalls(company: Company, script: IndustryScript): Call[] {
  const mk = (suffix: string, daysAgo: number, hour: number, minute: number, saved: boolean, fromNumber: string): Call => {
    const call: Call = {
      id: `call_${company.id}_${suffix}`,
      companyId: company.id,
      direction: "inbound",
      status: "missed",
      source: "seed_curated",
      fromNumber,
      language: "fr",
      startedAt: dateAt(daysAgo, hour, minute).toISOString(),
      durationSec: 0,
      scriptId: script.id,
      transcript: [],
      recordingUrl: null,
    };
    call.intelligence = intelligenceEngine.analyze(call, script, {
      savedReason: saved ? "rappel_sms" : undefined,
    });
    return call;
  };
  return [
    mk("miss1", 4, 12, 12, true, "514-555-0182"),
    mk("miss2", 6, 16, 48, true, "450-555-0173"),
    mk("miss3", 1, 7, 58, false, "438-555-0164"),
  ];
}
