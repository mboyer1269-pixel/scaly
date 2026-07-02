/**
 * Domaine — Scaly Event Boundary v1 (ADR-020).
 *
 * Scaly est l'adaptateur d'exécution voix/SMS, PAS la source de vérité
 * business. Chaque moment métier significatif devient un RuntimeEvent
 * appendé dans un outbox : Oria Action Ledger (et plus tard Memex Core)
 * les consommera SANS que Scaly ait à recoder sa persistance.
 *
 * Règles non négociables (testées) :
 *  - payload JSON-safe : jamais de fonction, de cycle, d'undefined, de Date brute ;
 *  - jamais de secret : clés et valeurs suspectes sont caviardées, pas propagées ;
 *  - jamais de transcript complet : `transcriptRef` / `summary` seulement ;
 *  - téléphones caviardés par défaut (masque + hash de corrélation).
 */

export const RUNTIME_EVENT_SOURCE = "scaly" as const;
export const RUNTIME_EVENT_SCHEMA_VERSION = 1;

export const RUNTIME_EVENT_TYPES = [
  "call.session_started",
  "call.transferred",
  "call.completed",
  "consent.captured",
  "sms.opt_out_received",
  "opportunity.detected",
  "recovery.gap_opened",
  "recovery.offer_sent",
  "recovery.offer_confirmed",
  "owner.notification_sent",
  "runtime.failure",
  /** Repli <Dial> parce que le pont realtime n'est pas configuré (≠ panne). */
  "runtime.realtime_unavailable",
] as const;

export type RuntimeEventType = (typeof RUNTIME_EVENT_TYPES)[number];

export type RuntimeEventStatus = "pending" | "delivered" | "failed";

/** Valeur JSON stricte — ce qui peut traverser la frontière sans surprise. */
export type JsonSafeValue = string | number | boolean | null | JsonSafeValue[] | { [key: string]: JsonSafeValue };

export type RuntimeEventPayload = Record<string, JsonSafeValue>;

export interface RuntimeEvent {
  id: string;
  companyId: string;
  source: typeof RUNTIME_EVENT_SOURCE;
  type: RuntimeEventType;
  /** Moment métier (ISO 8601) — distinct de createdAt (moment de l'append). */
  occurredAt: string;
  /** Relie tous les événements d'un même appel/flux (callSid Twilio en voix). */
  correlationId: string;
  /** Identifiant du système externe si disponible (callSid, MessageSid…). */
  externalId?: string;
  /** Idempotence : un retry Twilio ne crée jamais un double événement. */
  dedupeKey: string;
  schemaVersion: number;
  payload: RuntimeEventPayload;
  status: RuntimeEventStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/** Masque un téléphone pour un payload d'événement : seuls les 4 derniers chiffres restent. */
export function redactPhone(raw: string | undefined | null): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "inconnu";
  return `•••${digits.slice(-4)}`;
}

/** Clés dont la VALEUR est toujours caviardée (peu importe le contenu). */
const SECRET_KEY_PATTERN = /(secret|token|password|passwd|api[_-]?key|authorization|credential|database[_-]?url|connection[_-]?string|auth)/i;

/** Valeurs qui ressemblent à un secret, où qu'elles soient. */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/, // clés OpenAI et similaires
  /postgres(ql)?:\/\/\S+/i, // chaînes de connexion
  /npg_[A-Za-z0-9]+/, // credentials Neon
  /\b[a-z]+:\/\/[^\s/]*:[^\s@]*@/i, // URL avec user:pass@
  /Bearer\s+[A-Za-z0-9._-]{16,}/i,
  /\bAC[a-f0-9]{32}\b/, // Account SID Twilio
];

/** Clés interdites : le verbatim complet ne traverse JAMAIS la frontière. */
const FORBIDDEN_KEYS = new Set(["transcript", "turns", "verbatimtranscript"]);

const MAX_DEPTH = 6;
const MAX_STRING = 500;
const MAX_ARRAY = 50;
const MAX_KEYS = 50;

export interface SanitizedPayload {
  payload: RuntimeEventPayload;
  /** Trace honnête de ce qui a été caviardé/retiré (auditables, sans le contenu). */
  redactions: string[];
}

function sanitizeValue(value: unknown, path: string, depth: number, redactions: string[]): JsonSafeValue | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const t = typeof value;
  if (t === "string") {
    let s = value as string;
    for (const pattern of SECRET_VALUE_PATTERNS) {
      if (pattern.test(s)) {
        redactions.push(`${path}: valeur ressemblant à un secret caviardée`);
        return "[REDACTED]";
      }
    }
    if (s.length > MAX_STRING) {
      redactions.push(`${path}: tronqué à ${MAX_STRING} caractères`);
      s = `${s.slice(0, MAX_STRING)}…`;
    }
    return s;
  }
  if (t === "number") return Number.isFinite(value as number) ? (value as number) : null;
  if (t === "boolean") return value as boolean;
  if (t === "bigint") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (t === "function" || t === "symbol") {
    redactions.push(`${path}: type non sérialisable retiré`);
    return undefined;
  }
  if (depth >= MAX_DEPTH) {
    redactions.push(`${path}: profondeur maximale atteinte, sous-arbre retiré`);
    return undefined;
  }
  if (Array.isArray(value)) {
    const trimmed = value.length > MAX_ARRAY;
    if (trimmed) redactions.push(`${path}: tableau tronqué à ${MAX_ARRAY} éléments`);
    const out: JsonSafeValue[] = [];
    for (const [i, item] of value.slice(0, MAX_ARRAY).entries()) {
      const clean = sanitizeValue(item, `${path}[${i}]`, depth + 1, redactions);
      if (clean !== undefined) out.push(clean);
    }
    return out;
  }
  if (t === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_KEYS) redactions.push(`${path}: objet tronqué à ${MAX_KEYS} clés`);
    const out: Record<string, JsonSafeValue> = {};
    for (const [key, raw] of entries.slice(0, MAX_KEYS)) {
      const keyPath = path ? `${path}.${key}` : key;
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        redactions.push(`${keyPath}: transcript complet interdit — utiliser transcriptRef/summary`);
        continue;
      }
      if (SECRET_KEY_PATTERN.test(key)) {
        redactions.push(`${keyPath}: clé sensible caviardée`);
        out[key] = "[REDACTED]";
        continue;
      }
      const clean = sanitizeValue(raw, keyPath, depth + 1, redactions);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return undefined;
}

/**
 * Rend un payload arbitraire JSON-safe et sans secret. Pur et total : ne jette
 * jamais — un payload hostile devient un payload propre + la liste des caviardages.
 */
export function sanitizeRuntimeEventPayload(input: Record<string, unknown> | undefined): SanitizedPayload {
  const redactions: string[] = [];
  const clean = sanitizeValue(input ?? {}, "", 0, redactions);
  const payload = (clean && typeof clean === "object" && !Array.isArray(clean) ? clean : {}) as RuntimeEventPayload;
  return { payload, redactions };
}

/** Clé d'idempotence par défaut : un type d'événement par flux corrélé. */
export function defaultDedupeKey(type: RuntimeEventType, correlationId: string): string {
  return `${type}:${correlationId}`;
}
