/**
 * Balayeur de brouillons checkpointés périmés — la double panne (pont mort ET
 * callback action Twilio jamais abouti) laisse un Call `in_progress` orphelin,
 * invisible du dashboard et du rescue pour toujours. Le cron purge le finalise
 * en "abandoned" : transcript conservé, analyse rules-v1 (résumé exploitable),
 * audit. À ce stade l'appel est fini depuis longtemps — l'entrée devient
 * LÉGITIMEMENT visible de la file de rescue (« Rappeler quand même »).
 * Aucune action automatique n'est créée : pas de SMS surprise des heures après.
 */
import type { ScalyRepository } from "@/server/store";
import type { Call } from "@/domain/call";
import { getScriptById } from "@/data/industry-scripts";
import { intelligenceEngine } from "@/services/intelligence";

export const DEFAULT_CHECKPOINT_STALE_MINUTES = 60;

/**
 * SCALY_CHECKPOINT_STALE_MINUTES — seuil de péremption d'un brouillon depuis
 * son DERNIER flush (un appel vivant le rafraîchit à chaque tour). Doit rester
 * nettement au-dessus du plafond de durée du pont (SCALY_MAX_CALL_SECONDS)
 * pour ne jamais toucher un appel encore actif. 0/invalide → défaut.
 */
export function checkpointStaleMinutesFromEnv(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.SCALY_CHECKPOINT_STALE_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CHECKPOINT_STALE_MINUTES;
}

export async function expireStaleCheckpoints(
  store: ScalyRepository,
  opts: { staleMinutes?: number; now?: Date } = {},
): Promise<{ expired: number }> {
  const staleMinutes = opts.staleMinutes ?? DEFAULT_CHECKPOINT_STALE_MINUTES;
  const now = opts.now ?? new Date();
  const cutoff = now.getTime() - staleMinutes * 60_000;

  const calls = await store.listCalls();
  let expired = 0;
  for (const call of calls) {
    if (call.status !== "in_progress") continue;
    const lastFlush = new Date(call.provenance?.checkpointAt ?? call.startedAt).getTime();
    if (lastFlush >= cutoff) continue;

    const agent = await store.getAgentByCompany(call.companyId);
    const script = agent ? getScriptById(agent.qualificationScriptId) : undefined;
    const finalized: Call = {
      ...call,
      status: "abandoned",
      scriptId: call.scriptId ?? script?.id,
      provenance: call.provenance
        ? { provider: call.provenance.provider, externalId: call.provenance.externalId, verifiedAt: call.provenance.verifiedAt }
        : undefined,
    };
    if (script) finalized.intelligence = intelligenceEngine.analyze(finalized, script);

    // Write conditionnel : si un final atterrit entre la lecture et ici, il gagne.
    const written = await store.saveCallUnlessFinalized(finalized);
    if (!written) continue;
    await store.recordAudit({
      companyId: call.companyId,
      actor: "system",
      event: "brouillon_checkpoint_expiré",
      detail: `${call.id} · dernier flush ${call.provenance?.checkpointAt ?? "inconnu"} · ${call.transcript.length} tour(s) conservé(s)`,
    });
    expired += 1;
  }
  return { expired };
}
