/** Détail d'un appel — transcript + Call Intelligence + actions déclenchées. */
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, FileDown } from "lucide-react";
import { getStore } from "@/server/store";
import { getSessionRole } from "@/server/auth";
import { resolveCompanyId } from "@/server/tenant";
import { Badge, Card, HonestyNote, PageHeader } from "@/components/ui";
import { actionStatusBadge, callStatusBadge, leadBadge, sentimentLabel, urgencyBadge } from "@/lib/labels";
import { INTENT_LABELS, NEXT_ACTION_LABELS } from "@/domain/call";
import { ACTION_TYPE_LABELS } from "@/domain/action";
import { FIELD_LABELS, type FieldKey } from "@/domain/script";
import { formatCad, formatDateTime, formatDuration } from "@/lib/format";
import { AnalyzeButton } from "@/components/AnalyzeButton";
import { deriveCallReality } from "@/services/reality";
import { RealityBadge } from "@/components/RealityBadge";

export const dynamic = "force-dynamic";

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const store = getStore();
  const { id } = await params;
  const call = await store.getCall(id);
  // Garde d'appartenance (anti-IDOR) : un appel d'un autre tenant = introuvable, sauf fondateur.
  if (!call || (call.companyId !== await resolveCompanyId() && await getSessionRole() !== "founder")) notFound();
  const actions = await store.listActions(undefined, call.id);
  const intel = call.intelligence;
  const u = urgencyBadge(intel?.urgency);
  const l = leadBadge(intel?.leadQuality);
  const s = callStatusBadge(call.status);
  const evidence = (await store.listReadinessEvidence(call.companyId)).find((item) => item.callId === call.id);
  const reality = deriveCallReality(call, store.info(), evidence);

  return (
    <>
      <Link href="/calls" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Retour aux appels
      </Link>
      <PageHeader
        title={call.callerName ?? call.fromNumber}
        subtitle={`${formatDateTime(call.startedAt)} · ${formatDuration(call.durationSec)} · ${call.fromNumber} · langue ${call.language.toUpperCase()}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.tone}>{s.label}</Badge>
          <Badge tone={u.tone}>Urgence : {u.label}</Badge>
          <Badge tone={l.tone}>Lead : {l.label}</Badge>
          <RealityBadge reality={reality} />
          {intel?.saved && <Badge tone="emerald">Appel sauvé ({intel.saved.reason === "hors_heures" ? "hors heures" : "rappel SMS"})</Badge>}
          {call.status !== "in_progress" && (
            <a
              href={`/api/calls/${call.id}/evidence`}
              download
              className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50"
              title="Dossier d'appel horodaté et vérifiable (empreinte SHA-256)"
            >
              <FileDown size={12} /> Dossier d'appel
            </a>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title="Transcript" subtitle={call.source === "simulator" ? `Conversation simulée (seed ${call.seed ?? "—"} · script ${call.scriptId ?? "—"})` : call.source === "seed_curated" ? "Conversation de démonstration rédigée" : "Appel réel"}>
            {call.transcript.length === 0 && (
              <p className="py-4 text-sm text-ink-400">Aucun échange — appel manqué avant la prise en charge.</p>
            )}
            <ul className="space-y-3">
              {call.transcript.map((t, i) => (
                <li key={i} className={clsx("flex", t.speaker === "agent" ? "justify-start" : "justify-end")}>
                  <div className={clsx(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    t.speaker === "agent" ? "rounded-tl-sm bg-scaly-50 text-ink-800 ring-1 ring-scaly-100" : "rounded-tr-sm bg-ink-100 text-ink-800",
                  )}>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                      {t.speaker === "agent" ? "Maude" : "Appelant"} · {Math.round(t.atMs / 1000)} s{t.lang === "en" ? " · EN" : ""}
                    </p>
                    {t.text}
                  </div>
                </li>
              ))}
            </ul>
            {call.recordingUrl === null && (
              <p className="mt-4 text-xs text-ink-400">Enregistrement audio : indisponible pour cet appel simulé.</p>
            )}
          </Card>

          <Card title="Actions déclenchées" subtitle="planifiées par l'Action Engine, exécutées par les adapters (mock)">
            {actions.length === 0 && <p className="py-3 text-sm text-ink-400">Aucune action (ex. appel spam).</p>}
            <ul className="space-y-3">
              {actions.map((a) => {
                const st = actionStatusBadge(a.status);
                return (
                  <li key={a.id} className="rounded-lg border border-ink-100 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{a.title}</p>
                        <p className="text-xs text-ink-500">{ACTION_TYPE_LABELS[a.type]} · {a.attempts} tentative{a.attempts > 1 ? "s" : ""}</p>
                      </div>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-scaly-600">Audit trail ({a.audit.length})</summary>
                      <ul className="mt-2 space-y-1 border-l-2 border-ink-100 pl-3">
                        {a.audit.map((e, i) => (
                          <li key={i} className="text-xs text-ink-600">
                            <span className="font-medium text-ink-800">{e.event}</span>
                            {e.detail ? ` — ${e.detail}` : ""}
                            <span className="text-ink-400"> · {formatDateTime(e.at)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Ce que Maude a compris"
            action={
              <span className="inline-flex items-center gap-2">
                <Badge tone="violet">moteur {intel?.engine ?? "—"}</Badge>
                {call.transcript.length > 0 && <AnalyzeButton callId={call.id} />}
              </span>
            }
          >
            {!intel && <p className="text-sm text-ink-400">Aucune analyse.</p>}
            {intel && (
              <div className="space-y-4">
                <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-sm leading-relaxed text-ink-800">{intel.summary}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><dt className="text-xs text-ink-400">Intention</dt><dd className="font-medium">{INTENT_LABELS[intel.intent]} <span className="text-xs text-ink-400">({Math.round(intel.intentConfidence * 100)} %)</span></dd></div>
                  <div><dt className="text-xs text-ink-400">Sentiment</dt><dd className="font-medium">{sentimentLabel(intel.sentiment)}</dd></div>
                  <div><dt className="text-xs text-ink-400">Valeur estimée</dt><dd className="font-bold text-emerald-600">{formatCad(intel.estimatedValueCad)}</dd></div>
                  <div><dt className="text-xs text-ink-400">Base de valeur</dt><dd className="font-medium">{intel.valueBasis === "montant_mentionne" ? "Montant mentionné" : intel.valueBasis === "bareme_industrie" ? "Barème d'industrie" : "—"}</dd></div>
                  <div><dt className="text-xs text-ink-400">Prochaine action</dt><dd className="font-medium">{NEXT_ACTION_LABELS[intel.nextAction]}</dd></div>
                  <div><dt className="text-xs text-ink-400">Statut final</dt><dd className="font-medium">{intel.finalStatus.replace(/_/g, " ")}</dd></div>
                  <div><dt className="text-xs text-ink-400">Score commercial</dt><dd className="text-xl font-black text-ink-900">{intel.commercialScore}<span className="text-xs font-normal text-ink-400">/100</span></dd></div>
                  <div><dt className="text-xs text-ink-400">Confiance analyse</dt><dd className="font-medium">{Math.round(intel.confidence * 100)} %</dd></div>
                </dl>
                {intel.transferReason && (
                  <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">Transfert : {intel.transferReason}</p>
                )}
                <div>
                  <p className="mb-1.5 text-xs text-ink-400">Tags CRM</p>
                  <div className="flex flex-wrap gap-1.5">
                    {intel.tags.map((t) => <Badge key={t} tone="teal">{t}</Badge>)}
                  </div>
                </div>
                {Object.keys(intel.collectedFields).length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs text-ink-400">Informations collectées</p>
                    <dl className="space-y-1.5 text-sm">
                      {Object.entries(intel.collectedFields).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <dt className="w-28 shrink-0 text-xs font-medium text-ink-500">{FIELD_LABELS[k as FieldKey] ?? k}</dt>
                          <dd className="text-ink-800">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                <HonestyNote>
                  {intel.engine === "llm"
                    ? "Analyse produite par le moteur LLM (transcript brut, sortie structurée validée). Valeur et score recalculés par le barème déterministe."
                    : "Analyse produite par le moteur heuristique rules-v1 (mots-clés + règles de script). Cliquez « Analyser avec le LLM » pour comparer."}
                </HonestyNote>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
