/** Bibliothèque des scripts d'industrie — 15 verticales prêtes pour la démo. */
import { Badge, Card, HonestyNote, PageHeader } from "@/components/ui";
import { INDUSTRY_SCRIPTS } from "@/data/industry-scripts";
import { INDUSTRY_LABELS } from "@/domain/company";
import { NEXT_ACTION_LABELS } from "@/domain/call";
import { FIELD_LABELS } from "@/domain/script";
import { urgencyBadge } from "@/lib/labels";
import { formatCad } from "@/lib/format";

export default function ScriptsPage() {
  return (
    <>
      <PageHeader
        title="Scripts par industrie"
        subtitle={`${INDUSTRY_SCRIPTS.length} verticales — chaque script définit l'intention, les questions, les critères d'urgence/transfert, les objections et les tags CRM`}
      />
      <div className="mb-5">
        <HonestyNote>
          Les valeurs de référence (« valeur moyenne d'un mandat ») sont des hypothèses internes de travail, recalibrées avec chaque client — pas des données de marché.
        </HonestyNote>
      </div>
      <div className="space-y-4">
        {INDUSTRY_SCRIPTS.map((s) => (
          <Card key={s.id} className="overflow-hidden">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{INDUSTRY_LABELS[s.industry]}</p>
                  <p className="text-xs text-ink-500">{s.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="emerald">valeur réf. {formatCad(s.valueBaselineCad)}</Badge>
                  <Badge tone="teal">{s.crmTags[0]}</Badge>
                </div>
              </summary>
              <div className="mt-4 grid gap-5 border-t border-ink-100 pt-4 text-sm lg:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Accueil (FR)</p>
                    <p className="rounded-lg bg-ink-50 px-3 py-2 text-ink-700">{s.greeting}</p>
                    <p className="mt-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">EN — {s.greetingEn}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Informations à collecter</p>
                    <ul className="space-y-1">
                      {s.questions.map((q, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Badge tone={q.required ? "teal" : "slate"}>{FIELD_LABELS[q.fieldKey]}</Badge>
                          <span className="text-ink-600">{q.question}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Objections fréquentes</p>
                    <ul className="space-y-2">
                      {s.commonObjections.map((o, i) => (
                        <li key={i} className="rounded-lg border border-ink-100 px-3 py-2">
                          <p className="text-xs font-medium text-rose-600">« {o.objection} »</p>
                          <p className="mt-1 text-xs text-ink-600">{o.response}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Critères d'urgence</p>
                    <ul className="space-y-1.5">
                      {s.urgencyCriteria.map((c, i) => {
                        const b = urgencyBadge(c.level);
                        return (
                          <li key={i} className="flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
                            <Badge tone={b.tone}>{b.label}</Badge>
                            <span>{c.note} — mots-clés : {c.keywords.join(", ")}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Critères de transfert humain</p>
                    <ul className="list-inside list-disc space-y-1 text-xs text-ink-600">
                      {s.transferCriteria.map((t, i) => <li key={i}>{t.condition}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Action finale & résumé attendu</p>
                    <p className="text-xs text-ink-600">Action : <span className="font-semibold">{NEXT_ACTION_LABELS[s.finalAction]}</span></p>
                    <p className="mt-1 rounded-lg bg-ink-50 px-3 py-2 font-mono text-[11px] text-ink-600">{s.expectedSummary}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Tags CRM</p>
                    <div className="flex flex-wrap gap-1.5">{s.crmTags.map((t) => <Badge key={t} tone="teal">{t}</Badge>)}</div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Interdit à l'agent</p>
                    <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-500">
                      {s.forbiddenPhrases.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </details>
          </Card>
        ))}
      </div>
    </>
  );
}
