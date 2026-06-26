/**
 * /status — preuve de bout en bout, jamais « vert » par complaisance.
 * Sans paramètre : état déclaré du store. Avec ?live=1 : aller-retour RÉEL
 * (écriture + relecture + suppression en base) avant d'afficher « Réel (vérifié) ».
 */
import Link from "next/link";
import { CheckCircle2, Database, RefreshCw, XCircle } from "lucide-react";
import { getStore } from "@/server/store";
import { getVoiceStackHealth } from "@/adapters/voice/health";
import { isAuthEnabled } from "@/server/auth";
import { llmIntelligenceEngine } from "@/services/llm-intelligence";
import { runAllVoiceScenarios } from "@/services/voice-lab";
import { LATENCY_TARGET_P50_MS, LATENCY_TARGET_P95_MS } from "@/domain/voice";
import { Badge, Card, HonestyNote, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ live?: string }> }) {
  const store = getStore();
  const info = store.info();
  const live = (await searchParams).live === "1" ? await store.verifyLive() : null;
  const [companies, calls, actions, audit, voiceSessions] = await Promise.all([
    store.listCompanies(),
    store.listCalls(),
    store.listActions(),
    store.getAuditLog(10),
    store.listVoiceSessions(),
  ]);
  // Preuve vivante du Voice Lab : les 6 scénarios golden rejoués à CHAQUE rendu
  // (déterministes et purs — exactement ce que la CI verrouille).
  const voiceReport = runAllVoiceScenarios();

  const verdict = live
    ? live.ok && live.provider === "prisma"
      ? { tone: "emerald" as const, label: "Réel (vérifié)", Icon: CheckCircle2 }
      : live.ok
        ? { tone: "amber" as const, label: "Démo (mémoire)", Icon: Database }
        : { tone: "rose" as const, label: "Réel (échec de vérification)", Icon: XCircle }
    : info.provider === "prisma"
      ? { tone: "amber" as const, label: "Réel (non vérifié)", Icon: Database }
      : { tone: "amber" as const, label: "Démo (mémoire)", Icon: Database };

  return (
    <>
      <PageHeader title="Statut du système" subtitle="Persistance, pile vocale et conformité — l'état affiché est prouvé, pas déclaré">
        <div className="flex items-center gap-2">
          <Badge tone={verdict.tone}>
            <verdict.Icon size={13} className="mr-1" />
            {verdict.label}
          </Badge>
          <Link
            href="/status?live=1"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-xs font-medium text-white hover:bg-ink-700"
          >
            <RefreshCw size={12} />
            Vérifier en direct
          </Link>
        </div>
      </PageHeader>

      {!live && (
        <div className="mb-5">
          <HonestyNote>
            État déclaré seulement. Cliquez « Vérifier en direct » (ou ajoutez ?live=1) pour exécuter un aller-retour réel
            — écriture, relecture puis suppression d'une sentinelle en base — avant d'afficher « Réel (vérifié) ».
          </HonestyNote>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Persistance" subtitle={info.description}>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Provider</dt>
              <dd><Badge tone={info.provider === "prisma" ? "emerald" : "amber"}>{info.provider === "prisma" ? "Prisma / Postgres" : "In-memory (démo)"}</Badge></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Durabilité</dt>
              <dd className="font-medium text-ink-900">{info.persistent ? "Survit aux redémarrages" : "Régénéré à chaque redémarrage"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">STORE_PROVIDER</dt>
              <dd className="font-mono text-xs text-ink-700">{process.env.STORE_PROVIDER ?? "(non défini → memory)"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">DATABASE_URL</dt>
              <dd><Badge tone={process.env.DATABASE_URL ? "emerald" : "rose"}>{process.env.DATABASE_URL ? "définie" : "absente"}</Badge></dd>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 pt-3">
              <dt className="text-ink-500">Contenu</dt>
              <dd className="font-medium text-ink-900">{companies.length} entreprises · {calls.length} appels · {actions.length} actions</dd>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 pt-3">
              <dt className="text-ink-500">Auth (Clerk)</dt>
              <dd>
                <Badge tone={isAuthEnabled() ? "emerald" : "amber"}>
                  {isAuthEnabled() ? "Active — RBAC founder/owner/staff" : "Désactivée (clés absentes)"}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Moteur LLM</dt>
              <dd>
                <Badge tone={llmIntelligenceEngine.isConfigured() ? "emerald" : "amber"}>
                  {llmIntelligenceEngine.isConfigured()
                    ? `Configuré (${process.env.SCALY_LLM_MODEL ?? "gpt-4o-mini"})`
                    : "Non configuré — rules-v1 seulement"}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Purge Loi 25</dt>
              <dd>
                <Badge tone={process.env.CRON_SECRET ? "emerald" : "amber"}>
                  {process.env.CRON_SECRET ? "Cron protégé configuré" : "CRON_SECRET absent (db:purge manuel)"}
                </Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Vérification en direct" subtitle="aller-retour réel vers la persistance">
          {!live && <p className="py-4 text-sm text-ink-400">Aucune vérification exécutée sur cette page. Utilisez « Vérifier en direct ».</p>}
          {live && (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Résultat</dt>
                <dd>
                  <Badge tone={live.ok ? (live.provider === "prisma" ? "emerald" : "amber") : "rose"}>
                    {live.ok ? (live.provider === "prisma" ? "Réel (vérifié)" : "Mémoire (aucune base)") : "Échec"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Latence</dt>
                <dd className="font-medium text-ink-900">{live.latencyMs} ms</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Vérifié à</dt>
                <dd className="font-medium text-ink-900">{formatDateTime(live.verifiedAt)}</dd>
              </div>
              <div className="border-t border-ink-100 pt-3">
                <dt className="mb-1 text-ink-500">Détail</dt>
                <dd className={live.ok ? "rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800" : "rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800"}>
                  {live.detail}
                </dd>
              </div>
            </dl>
          )}
        </Card>
      </div>

      <Card title="Pile vocale" subtitle="état honnête des providers — rien n'est « vert » par complaisance" className="mt-6">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {getVoiceStackHealth().map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-ink-900">{p.name}</p>
                <p className="text-xs text-ink-500">{p.note}</p>
              </div>
              <Badge tone={p.status === "operationnel" ? "emerald" : p.status === "degrade" ? "amber" : "slate"}>
                {p.status === "operationnel" ? "Opérationnel" : p.status === "degrade" ? "Dégradé" : "Non configuré"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Voice Lab (P2A)"
        subtitle="les 6 scénarios golden rejoués en direct à chaque affichage de cette page — même vert que la CI"
        className="mt-6"
        action={
          <Badge tone={voiceReport.allPass ? "emerald" : "rose"}>
            {voiceReport.checks.filter((c) => c.pass).length}/{voiceReport.checks.length} scénarios verts
          </Badge>
        }
      >
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {voiceReport.checks.map((c) => (
            <li key={c.scenarioId} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{c.title}</p>
                <p className="truncate text-xs text-ink-500">
                  {c.pass
                    ? `${c.session.telemetry.fieldsConfirmed} champ(s) confirmé(s) · p95 ${c.session.telemetry.perceivedP95Ms} ms`
                    : c.failures.join(" ; ")}
                </p>
              </div>
              <Badge tone={c.pass ? "emerald" : "rose"}>{c.pass ? "Vert" : "Échec"}</Badge>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-ink-100 pt-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink-500">Budget latence (simulée, déclarée telle)</dt>
            <dd>
              <Badge tone={voiceReport.latencyBudgetMet ? "emerald" : "rose"}>
                p50 {voiceReport.aggregateP50Ms} ms / p95 {voiceReport.aggregateP95Ms} ms · cibles &lt; {LATENCY_TARGET_P50_MS} / {LATENCY_TARGET_P95_MS} ms
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-500">Sessions sauvegardées</dt>
            <dd className="font-medium text-ink-900">{voiceSessions.length} dans le store ({info.provider})</dd>
          </div>
        </dl>
      </Card>

      <Card title="Derniers événements d'audit" subtitle="journal de conformité (Loi 25)" className="mt-6">
        <ul className="space-y-1.5">
          {audit.map((e, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
              <span className="text-ink-400">{formatDateTime(e.at)}</span>
              <Badge tone="slate">{e.actor}</Badge>
              <span className="font-medium text-ink-800">{e.event}</span>
              {e.detail && <span className="text-ink-500">— {e.detail}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
