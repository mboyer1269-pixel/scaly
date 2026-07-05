/**
 * Plafond dur de durée par appel — contrôle des coûts (OpenAI Realtime facture
 * à la minute) et anti-appel-fantôme (ligne ouverte oubliée, boucle infinie).
 * À l'expiration, le pont transfère à l'humain via l'API Twilio ; si le
 * transfert échoue, il ferme le WS — Twilio déclenche alors l'action <Connect>
 * et le webhook sert le repli <Dial>. Le téléphone ne casse jamais : il change
 * de mains. Le transcript est déjà checkpointé, rien n'est perdu.
 */

export const DEFAULT_MAX_CALL_SECONDS = 900; // 15 min — généreux pour une réceptionniste PME

/** SCALY_MAX_CALL_SECONDS : secondes par appel. 0 = désactivé, invalide/absent = défaut. */
export function maxCallSecondsFromEnv(env: Record<string, string | undefined> = process.env): number {
  const raw = env.SCALY_MAX_CALL_SECONDS;
  if (raw === undefined || raw === "") return DEFAULT_MAX_CALL_SECONDS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_CALL_SECONDS;
  return Math.floor(n);
}

export interface CallCap {
  /** Arme le chrono au début de l'appel (no-op si désactivé ou déjà armé). */
  start(): void;
  /** Désarme (fin d'appel) — l'expiration ne peut plus se déclencher. */
  stop(): void;
}

export function createCallCap(maxSeconds: number, onExpire: () => void): CallCap {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    start() {
      if (maxSeconds <= 0 || timer) return;
      timer = setTimeout(() => {
        timer = null;
        onExpire();
      }, maxSeconds * 1000);
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
