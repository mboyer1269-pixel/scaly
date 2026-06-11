/**
 * Purge Loi 25 — le verbatim disparaît après retentionDays, l'intelligence reste.
 * IMPORTANT : on instancie InMemoryStore DIRECTEMENT. Ne jamais utiliser getStore()
 * dans un test : @prisma/client charge .env dans process.env à l'import, ce qui
 * peut faire pointer getStore() vers la vraie base locale (incident du 2026-06-10 —
 * un test de purge a vidé les transcripts du Postgres de dev).
 */
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "@/server/store";
import { runVoiceScenario } from "@/services/voice-lab";
import { voiceSessionToRecord } from "@/services/voice-convert";
import { VOICE_SCENARIOS } from "@/data/voice-scenarios";

describe("purgeExpiredTranscripts", () => {
  it("vide les transcripts expirés mais conserve l'intelligence", async () => {
    const store = new InMemoryStore();
    const before = await store.listCalls();
    const withTranscript = before.filter((c) => c.transcript.length > 0);
    expect(withTranscript.length).toBeGreaterThan(0);

    // Un « maintenant » 10 ans dans le futur force l'expiration de tout le seed.
    const farFuture = new Date(Date.now() + 3650 * 86_400_000);
    const { purged } = await store.purgeExpiredTranscripts(farFuture);
    expect(purged).toBe(withTranscript.length);

    const after = await store.listCalls();
    expect(after.every((c) => c.transcript.length === 0)).toBe(true);
    // L'analyse agrégée (résumé, intention, valeur) survit à la purge du verbatim.
    const stillAnalyzed = after.filter((c) => c.intelligence);
    expect(stillAnalyzed.length).toBeGreaterThan(0);

    // Purge idempotente : second passage → rien à purger.
    const second = await store.purgeExpiredTranscripts(farFuture);
    expect(second.purged).toBe(0);
  });

  it("ne purge rien à l'intérieur de la fenêtre de rétention", async () => {
    const store = new InMemoryStore();
    const { purged, voicePurged } = await store.purgeExpiredTranscripts(new Date());
    // Le seed couvre ~13 jours ; toutes les rétentions configurées sont plus longues.
    expect(purged).toBe(0);
    expect(voicePurged).toBe(0);
  });

  it("purge le verbatim des sessions vocales mais conserve fiche et télémétrie", async () => {
    const store = new InMemoryStore();
    const session = runVoiceScenario(VOICE_SCENARIOS[0]);
    await store.saveVoiceSession(voiceSessionToRecord(session));

    const farFuture = new Date(Date.now() + 3650 * 86_400_000);
    const { voicePurged } = await store.purgeExpiredTranscripts(farFuture);
    expect(voicePurged).toBe(1);

    const after = await store.getVoiceSession(session.id);
    expect(after?.turns).toEqual([]);
    expect(after?.events).toEqual([]);
    // L'agrégé survit : champs qualifiés et télémétrie restent consultables.
    expect(after?.fields.some((f) => f.value)).toBe(true);
    expect(after?.telemetry.turnCount).toBeGreaterThan(0);
  });
});
