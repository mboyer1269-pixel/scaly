/**
 * Rate limiting — fenêtre glissante en mémoire (P4).
 *
 * HONNÊTETÉ : la mémoire est PAR INSTANCE serverless. Sur Vercel, plusieurs
 * instances = plafond effectif multiplié d'autant. C'est suffisant pour
 * protéger les routes coûteuses (LLM, Stripe) contre l'abus naïf en pilote ;
 * un vrai plafond global passera par Upstash/Redis ou le WAF Vercel quand le
 * trafic le justifiera.
 */

export interface RateLimiter {
  /** Vérifie et consomme une requête pour cette clé. */
  check(key: string, now?: number): { allowed: boolean; retryAfterSec: number };
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now = Date.now()) {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
      }
      recent.push(now);
      hits.set(key, recent);
      // Borne la table : purge paresseuse quand elle grossit (anti-fuite mémoire).
      if (hits.size > 10_000) {
        for (const [k, v] of hits) {
          if (v.every((t) => t <= cutoff)) hits.delete(k);
        }
      }
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

/** Clé client : premier IP de x-forwarded-for (Vercel le pose), sinon « locale ». */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "locale";
}

/** Réponse 429 uniforme avec Retry-After. */
export function tooManyRequests(retryAfterSec: number): Response {
  return new Response(JSON.stringify({ error: "Trop de requêtes — réessayez dans un instant." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSec) },
  });
}
