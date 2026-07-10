/**
 * Checkpointer — flush du transcript vers POST /api/voice/checkpoint à chaque
 * tour stable (jamais par token). Si le pont crash avant le final, le backend
 * garde un brouillon exploitable : l'appel est sauvé ET la mémoire aussi.
 *
 * Coalescé : une seule requête en vol par appel ; les tours ajoutés pendant
 * l'envoi déclenchent UN re-flush avec l'état cumulé le plus récent (le log
 * est une référence vivante, sérialisée au moment de l'envoi).
 * Best-effort : un échec est loggé, jamais propagé — le checkpoint ne doit
 * JAMAIS perturber l'audio temps réel.
 */

export interface CheckpointLog {
  callSid: string;
  from: string;
  companyId: string;
  startedAt: string;
  turns: { speaker: "agent" | "caller"; text: string; atMs: number; lang?: string }[];
}

export interface CheckpointerOptions {
  appUrl: string;
  secret?: string;
  /** Injectable pour les tests. */
  fetchImpl?: typeof fetch;
  /** Préfixe des logs console ("realtime" ou "relay"). */
  tag?: string;
}

export interface Checkpointer {
  /** À appeler après chaque tour ajouté au log. Fire-and-forget. */
  onTurn(log: CheckpointLog): void;
  /** Attente des envois en cours (tests). */
  idle(): Promise<void>;
}

export function createCheckpointer(opts: CheckpointerOptions): Checkpointer {
  const doFetch = opts.fetchImpl ?? fetch;
  const tag = opts.tag ?? "realtime";
  let inflight: Promise<void> | null = null;
  let dirty = false;
  let disabled = false;

  async function send(log: CheckpointLog): Promise<void> {
    try {
      const res = await doFetch(`${opts.appUrl}/api/voice/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(opts.secret ? { "x-scaly-secret": opts.secret } : {}) },
        body: JSON.stringify(log),
      });
      if (res.status === 404) {
        // App pas encore déployée avec la route — on arrête de marteler.
        disabled = true;
        console.error(`[${tag}] /api/voice/checkpoint absent (404) — checkpoints désactivés pour ${log.callSid}.`);
      } else if (!res.ok) {
        console.error(`[${tag}] Checkpoint refusé pour ${log.callSid} : ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      console.error(`[${tag}] Checkpoint échoué pour ${log.callSid} : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function pump(log: CheckpointLog): void {
    if (disabled || log.turns.length === 0) return;
    if (inflight) {
      dirty = true;
      return;
    }
    inflight = send(log).finally(() => {
      inflight = null;
      if (dirty) {
        dirty = false;
        pump(log);
      }
    });
  }

  return {
    onTurn: pump,
    async idle() {
      while (inflight) await inflight;
    },
  };
}
