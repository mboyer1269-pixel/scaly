/**
 * Pilot Readiness Gate — évaluateur PUR et déterministe (ADR-019).
 *
 * Répond, sans complaisance, aux 7 questions du premier pilote réel :
 *  1. Peut-on faire un premier appel réel aujourd'hui ?
 *  2. Qu'est-ce qui est bloquant ?
 *  3. Qu'est-ce qui est réel / configuré / repli / non vérifié ?
 *  4. Le repli humain fonctionne-t-il si le realtime tombe ?
 *  5. Le tenant utilisé est-il explicite et non dangereux ?
 *  6. La mémoire inter-appels peut-elle halluciner ou croiser des tenants ?
 *  7. Les commandes de validation et les tests garde-fous existent-ils ?
 *
 * Fonction pure : aucune IO, aucun accès à process.env ni au store. Le CLI
 * (scripts/pilot-check.ts) collecte l'environnement + les faits du dépôt et la
 * vérification vivante de la base, puis appelle evaluatePilotReadiness().
 * C'est ce qui la rend testable (tests/pilot-readiness.test.ts).
 */

export type GateStatus = "pass" | "warn" | "fail";

export interface GateCheck {
  id: string;
  label: string;
  status: GateStatus;
  detail: string;
  /** true si ce check bloque un premier appel réel ICI ET MAINTENANT. */
  blocking?: boolean;
}

/** Sous-ensemble typé de l'environnement — gardé étroit pour rester pur et testable. */
export interface PilotEnv {
  NODE_ENV?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  STORE_PROVIDER?: string;
  DATABASE_URL?: string;
  REALTIME_SHARED_SECRET?: string;
  TWILIO_AUTH_TOKEN?: string;
  SCALY_REALTIME_WS_URL?: string;
  SCALY_PUBLIC_URL?: string;
  OPENAI_API_KEY?: string;
  CRON_SECRET?: string;
  SCALY_AUTH_MODE?: string;
}

export interface PilotFacts {
  /** scripts de package.json (pour vérifier que typecheck/test/build existent). */
  packageScripts: Record<string, string>;
  /** noms de fichiers de tests/ (pour vérifier les garde-fous golden/voix/mémoire). */
  testFiles: string[];
  /**
   * Mapping Twilio numéro appelé → companyId implémenté ?
   * false tant qu'il n'existe pas : le webhook voix résout DEFAULT_COMPANY_ID,
   * donc PILOTE MONO-TENANT UNIQUEMENT (ADR-017).
   */
  twilioTenantMapping: boolean;
  /** Aller-retour réel en base (CLI seulement, si STORE_PROVIDER=prisma). Absent = non vérifié. */
  liveCheck?: { ok: boolean; detail: string };
}

export interface PilotReadinessReport {
  verdict: GateStatus;
  /** true tant que le mapping Twilio→companyId n'existe pas. */
  singleTenantOnly: boolean;
  /** Réponse froide : un premier appel réel est-il possible aujourd'hui ? */
  canMakeRealCall: { possible: boolean; mode: "ia" | "repli_humain" | "non"; reason: string };
  checks: GateCheck[];
  /** Les bloquants (status fail OU blocking:true), pour le résumé exécutif. */
  blockers: GateCheck[];
}

const WORSE: Record<GateStatus, number> = { pass: 0, warn: 1, fail: 2 };
function worst(a: GateStatus, b: GateStatus): GateStatus {
  return WORSE[a] >= WORSE[b] ? a : b;
}

export function evaluatePilotReadiness(env: PilotEnv, facts: PilotFacts): PilotReadinessReport {
  const checks: GateCheck[] = [];
  const add = (c: GateCheck) => checks.push(c);

  const isProd = env.NODE_ENV === "production";
  const authEnabled = Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
  const authRequired = env.SCALY_AUTH_MODE === "required" || (isProd && env.SCALY_AUTH_MODE !== "demo-open");
  const storeProvider = env.STORE_PROVIDER === "prisma" ? "prisma" : "memory";
  const hasDbUrl = Boolean(env.DATABASE_URL);
  const hasRealtimeSecret = Boolean(env.REALTIME_SHARED_SECRET);
  const hasTwilioToken = Boolean(env.TWILIO_AUTH_TOKEN);
  const hasRealtimeWs = Boolean(env.SCALY_REALTIME_WS_URL);
  const hasOpenAi = Boolean(env.OPENAI_API_KEY);
  const hasCronSecret = Boolean(env.CRON_SECRET);
  // Le webhook est joignable publiquement dès qu'une URL publique est posée
  // (ngrok/Vercel) ou en production — c'est là que la signature Twilio compte.
  const publicWebhook = Boolean(env.SCALY_PUBLIC_URL) || isProd;

  // 1. Auth ----------------------------------------------------------------
  if (authEnabled) {
    add({ id: "auth", label: "Authentification", status: "pass", detail: "Clerk active — RBAC founder/owner/staff." });
  } else if (authRequired) {
    add({ id: "auth", label: "Authentification", status: "fail", blocking: true, detail: "Auth requise mais clés Clerk absentes → les surfaces protégées retournent 503 (fail-closed)." });
  } else {
    add({ id: "auth", label: "Authentification", status: "warn", detail: "Désactivée — mode dev/démo ouvert ASSUMÉ (clés Clerk absentes)." });
  }

  // 2. Cohérence de la persistance -----------------------------------------
  if (storeProvider === "prisma" && hasDbUrl) {
    add({ id: "store", label: "Persistance", status: "pass", detail: "STORE_PROVIDER=prisma + DATABASE_URL présente." });
  } else if (storeProvider === "prisma" && !hasDbUrl) {
    add({ id: "store", label: "Persistance", status: "fail", blocking: true, detail: "STORE_PROVIDER=prisma mais DATABASE_URL absente — la base ne peut pas s'ouvrir." });
  } else if (isProd) {
    add({ id: "store", label: "Persistance", status: "fail", blocking: true, detail: "STORE_PROVIDER=memory en production — les appels réels seraient perdus au redémarrage." });
  } else {
    add({ id: "store", label: "Persistance", status: "warn", detail: `In-memory (démo)${hasDbUrl ? " — DATABASE_URL définie mais IGNORÉE (provider=memory)" : ""}.` });
  }

  // 3. Vérification vivante de la base (Prisma uniquement) ------------------
  if (storeProvider === "prisma") {
    if (!facts.liveCheck) {
      add({ id: "store_live", label: "Base — aller-retour réel", status: "warn", detail: "Non vérifié (lancer le gate avec la base accessible, ou /status?live=1)." });
    } else if (facts.liveCheck.ok) {
      add({ id: "store_live", label: "Base — aller-retour réel", status: "pass", detail: facts.liveCheck.detail });
    } else {
      add({ id: "store_live", label: "Base — aller-retour réel", status: "fail", blocking: true, detail: `Échec de l'aller-retour : ${facts.liveCheck.detail}` });
    }
  }

  // 4. Secret partagé pont ↔ app -------------------------------------------
  if (hasRealtimeSecret) {
    add({ id: "realtime_secret", label: "Secret pont realtime", status: "pass", detail: "REALTIME_SHARED_SECRET présent — /api/voice/context et /complete protégés." });
  } else if (isProd) {
    add({ id: "realtime_secret", label: "Secret pont realtime", status: "fail", blocking: true, detail: "REALTIME_SHARED_SECRET absent en production — /api/voice/context et /complete renvoient 503 (sessions refusées)." });
  } else {
    add({ id: "realtime_secret", label: "Secret pont realtime", status: "warn", detail: "Absent — toléré hors production (endpoints ouverts en local seulement)." });
  }

  // 5. Signature Twilio si webhook public ----------------------------------
  if (hasTwilioToken) {
    add({ id: "twilio_signature", label: "Signature Twilio", status: "pass", detail: "TWILIO_AUTH_TOKEN présent — X-Twilio-Signature vérifiée." });
  } else if (publicWebhook) {
    add({ id: "twilio_signature", label: "Signature Twilio", status: "fail", blocking: true, detail: "Webhook joignable publiquement SANS TWILIO_AUTH_TOKEN — n'importe qui peut forger des appels entrants." });
  } else {
    add({ id: "twilio_signature", label: "Signature Twilio", status: "warn", detail: "Absent — local seulement : vérification sautée et TRACÉE dans l'audit." });
  }

  // 6. Transport temps réel + repli humain (le téléphone ne casse jamais) ---
  if (!hasRealtimeWs) {
    add({ id: "realtime_transport", label: "Transport / repli", status: "warn", detail: "SCALY_REALTIME_WS_URL absente → repli <Dial> vers l'humain ACTIF. Le téléphone ne casse pas, mais aucune IA vocale." });
  } else if (hasRealtimeWs && !hasOpenAi) {
    // Piège dangereux : le webhook sert <Connect><Stream> car le WS est posé,
    // mais le pont refuse la session sans OpenAI → l'appel TOMBE (le repli <Dial>
    // ne se déclenche QUE lorsque le WS est absent).
    add({ id: "realtime_transport", label: "Transport / repli", status: "fail", blocking: true, detail: "WS posé mais OPENAI_API_KEY absent côté pont : le webhook ouvre le Stream, le pont refuse → l'appel tombe SANS repli <Dial>." });
  } else {
    add({ id: "realtime_transport", label: "Transport / repli", status: "pass", detail: "Media Stream → OpenAI Realtime configuré ; repli <Dial> reste le filet en cas de coupure du pont." });
  }

  // 7. OpenAI (IA vocale + analyse) ----------------------------------------
  add(
    hasOpenAi
      ? { id: "openai", label: "OpenAI", status: "pass", detail: "OPENAI_API_KEY présent — IA vocale et analyse LLM possibles." }
      : { id: "openai", label: "OpenAI", status: "warn", detail: "Absent — pas d'IA vocale ; analyse en repli rules-v1 (honnête)." },
  );

  // 8. Tenant explicite & posture mono-tenant ------------------------------
  if (!facts.twilioTenantMapping) {
    add({
      id: "tenant_mapping",
      label: "Résolution de tenant (voix)",
      status: "warn",
      detail: "Mapping Twilio numéro→companyId ABSENT : le webhook voix résout DEFAULT_COMPANY_ID. PILOTE MONO-TENANT UNIQUEMENT — bloquant AVANT un 2ᵉ client (ADR-017/019).",
    });
  } else {
    add({ id: "tenant_mapping", label: "Résolution de tenant (voix)", status: "pass", detail: "Mapping Twilio numéro→companyId présent — multi-tenant voix possible." });
  }
  add(
    authEnabled
      ? { id: "tenant_session", label: "Tenant de session", status: "pass", detail: "Routes de session via resolveCompanyId() (claim Clerk) ; repli démo SIGNALÉ pour un non-founder sans claim (ADR-019)." }
      : { id: "tenant_session", label: "Tenant de session", status: "warn", detail: "Auth désactivée → tenant démo (DEFAULT_COMPANY_ID) assumé pour toutes les routes." },
  );

  // 9. Commandes de validation (le contrat CI) -----------------------------
  const required = ["typecheck", "test", "build"];
  const missing = required.filter((s) => !facts.packageScripts[s]);
  add(
    missing.length === 0
      ? { id: "ci_commands", label: "Commandes CI", status: "pass", detail: "typecheck + test + build présents dans package.json." }
      : { id: "ci_commands", label: "Commandes CI", status: "fail", blocking: true, detail: `Scripts manquants : ${missing.join(", ")}.` },
  );

  // 10. Garde-fous testés (golden + voix + mémoire) ------------------------
  const has = (frag: string) => facts.testFiles.some((f) => f.includes(frag));
  const guardrails: { frag: string; name: string }[] = [
    { frag: "golden-set", name: "golden set LLM" },
    { frag: "voice-scenarios", name: "scénarios vocaux" },
    { frag: "voice-runtime", name: "runtime vocal" },
    { frag: "caller-memory", name: "mémoire appelant" },
    { frag: "tenant", name: "résolution de tenant" },
  ];
  const missingGuards = guardrails.filter((g) => !has(g.frag));
  add(
    missingGuards.length === 0
      ? { id: "guardrails", label: "Tests garde-fous", status: "pass", detail: "Golden set, scénarios/runtime vocaux, mémoire appelant et tenant tous couverts." }
      : { id: "guardrails", label: "Tests garde-fous", status: "fail", blocking: true, detail: `Tests garde-fous absents : ${missingGuards.map((g) => g.name).join(", ")}.` },
  );

  // 11. Purge Loi 25 -------------------------------------------------------
  add(
    hasCronSecret
      ? { id: "purge", label: "Purge Loi 25", status: "pass", detail: "CRON_SECRET présent — /api/cron/purge protégé." }
      : { id: "purge", label: "Purge Loi 25", status: "warn", detail: "CRON_SECRET absent — purge manuelle via `npm run db:purge`." },
  );

  // --- Verdict global -----------------------------------------------------
  const verdict = checks.reduce<GateStatus>((acc, c) => worst(acc, c.status), "pass");
  const blockers = checks.filter((c) => c.status === "fail" || c.blocking);

  // --- Premier appel réel possible aujourd'hui ? --------------------------
  const liveBlockers = checks.filter((c) => c.blocking && c.status === "fail");
  let canMakeRealCall: PilotReadinessReport["canMakeRealCall"];
  if (liveBlockers.length > 0) {
    canMakeRealCall = { possible: false, mode: "non", reason: `Bloquants : ${liveBlockers.map((b) => b.label).join(", ")}.` };
  } else if (hasRealtimeWs && hasOpenAi) {
    canMakeRealCall = { possible: true, mode: "ia", reason: "Webhook + pont + OpenAI configurés — appel IA complet (mono-tenant)." };
  } else {
    canMakeRealCall = { possible: true, mode: "repli_humain", reason: "Pas de pont IA actif — l'appel aboutit, mais via le repli <Dial> vers l'humain seulement." };
  }

  return { verdict, singleTenantOnly: !facts.twilioTenantMapping, canMakeRealCall, checks, blockers };
}
