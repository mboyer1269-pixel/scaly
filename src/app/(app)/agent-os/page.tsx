/**
 * /agent-os — Console fondateur de l'Agent Operating Backend v1 (ADR-021).
 *
 * Pas une feature client : la preuve, en 30 secondes, que le backend fait
 * NAÎTRE des agents — Allô Maude exprimée comme AgentDefinition, son plan
 * runtime résolu en direct contre le tenant courant, et trois prompts qui
 * deviennent des drafts d'agents structurés.
 */
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { ALLO_MAUDE_AGENT } from "@/data/agent-definitions";
import { resolveAgentRuntimePlan, type AgentEnvFacts } from "@/services/agent-runtime-plan";
import { DEMO_PROMPTS, draftAgentDefinitionFromPrompt } from "@/services/agent-draft";
import { Badge, Card, HonestyNote, PageHeader, Stat } from "@/components/ui";
import type { Tone } from "@/lib/labels";

export const dynamic = "force-dynamic";

const CHECK_TONE: Record<"pass" | "warn" | "fail", Tone> = { pass: "emerald", warn: "amber", fail: "rose" };
const CHECK_LABEL: Record<"pass" | "warn" | "fail", string> = { pass: "OK", warn: "Limité", fail: "Bloqué" };
const VERDICT_BADGE: Record<string, { label: string; tone: Tone }> = {
  operational: { label: "Opérationnel", tone: "emerald" },
  degraded: { label: "Dégradé — limites explicites", tone: "amber" },
  not_ready: { label: "Pas prêt", tone: "rose" },
};
const OWNER_TONE: Record<string, Tone> = { scaly: "teal", oria: "violet", memex: "sky" };
const BASIS_LABEL: Record<string, { label: string; tone: Tone }> = {
  measured: { label: "Mesuré", tone: "emerald" },
  estimated_baseline: { label: "Barème (estimé)", tone: "amber" },
};

/** Faits d'environnement collectés ICI (la fonction de plan reste pure). */
function collectEnvFacts(): AgentEnvFacts {
  return {
    twilioCredentialsConfigured: Boolean(process.env.TWILIO_AUTH_TOKEN),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    realtimeBridgeConfigured: Boolean(process.env.SCALY_REALTIME_WS_URL),
  };
}

export default async function AgentOsPage() {
  const companyId = await resolveCompanyId();
  const company = await getStore().getCompany(companyId);
  const plan = company ? resolveAgentRuntimePlan(ALLO_MAUDE_AGENT, company, collectEnvFacts()) : undefined;
  const drafts = DEMO_PROMPTS.map((prompt) => ({ prompt, result: draftAgentDefinitionFromPrompt(prompt) }));
  const verdictBadge = plan ? VERDICT_BADGE[plan.verdict] : undefined;

  return (
    <>
      <PageHeader
        title="Agent OS — console fondateur"
        subtitle="Un agent n'est pas un prompt : c'est un contrat que le backend sait résoudre, opérer et mesurer. Allô Maude est le premier."
      />

      {plan && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Score de préparation" value={`${plan.readinessScore}/100`} tone={plan.readinessScore >= 80 ? "emerald" : plan.readinessScore >= 50 ? "amber" : "rose"} sub={verdictBadge?.label} />
          <Stat label="Capabilities activées" value={`${plan.enabledCapabilities.length}/${plan.capabilities.length}`} tone="teal" sub="registre déclaratif" />
          <Stat label="Événements de frontière" value={String(plan.emittedEvents.length)} tone="sky" sub="RuntimeEvent (ADR-020)" />
          <Stat label="Métriques ROI" value={String(ALLO_MAUDE_AGENT.roiMetrics.length)} tone="violet" sub="méthode explicite, jamais magique" />
        </div>
      )}

      <Card
        title={`${ALLO_MAUDE_AGENT.name} — AgentDefinition`}
        subtitle="Le premier agent exprimé par le contrat : persona, canaux, adaptateurs et ports backend — plus un paquet de code dispersé."
        className="mb-4"
      >
        <p className="text-sm text-ink-700">{ALLO_MAUDE_AGENT.persona}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="emerald">statut : {ALLO_MAUDE_AGENT.status === "live" ? "en service" : "draft"}</Badge>
          {ALLO_MAUDE_AGENT.channels.map((c) => (
            <Badge key={c} tone="teal">canal : {c}</Badge>
          ))}
          {ALLO_MAUDE_AGENT.runtimeAdapters.map((a) => (
            <Badge key={a} tone="slate">{a}</Badge>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-500">
          <span>Ports backend :</span>
          <Badge tone="violet">{ALLO_MAUDE_AGENT.backendBindings.contextPack}</Badge>
          <Badge tone="violet">{ALLO_MAUDE_AGENT.backendBindings.actionLedger}</Badge>
          <Badge tone="violet">{ALLO_MAUDE_AGENT.backendBindings.eventOutbox}</Badge>
        </div>
      </Card>

      {plan && (
        <>
          <Card
            title={`Plan runtime — ${plan.companyName}`}
            subtitle="Résolu en direct : « cet agent est-il prêt à opérer pour cette compagnie ? » a une réponse structurée, pas une opinion."
            className="mb-4"
          >
            <div className="space-y-2">
              {plan.capabilities.map((item) => (
                <div key={item.capabilityId} className="flex flex-wrap items-start gap-2 rounded-lg bg-ink-50/60 px-3 py-2">
                  <Badge tone={item.enabled ? "emerald" : "rose"}>{item.enabled ? "Activée" : "Désactivée"}</Badge>
                  <span className="text-sm font-medium text-ink-900">{item.displayName}</span>
                  <span className="basis-full text-xs text-ink-500">{item.reason}</span>
                </div>
              ))}
            </div>
            {plan.missingConfiguration.length > 0 && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                Configuration manquante : {plan.missingConfiguration.join(", ")}
              </p>
            )}
          </Card>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card title="Besoins de contexte" subtitle="Ce que l'agent doit savoir — et qui en sera propriétaire dans l'écosystème.">
              <ul className="space-y-2">
                {ALLO_MAUDE_AGENT.contextNeeds.map((need) => (
                  <li key={need.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-ink-800">{need.id}</span>
                    <Badge tone={OWNER_TONE[need.futureOwner] ?? "slate"}>→ {need.futureOwner}</Badge>
                    <span className="basis-full text-xs text-ink-500">{need.description}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Événements émis (outbox ADR-020)" subtitle="Chaque moment métier franchit la frontière — Oria et Memex les consommeront.">
              <div className="flex flex-wrap gap-1.5">
                {plan.emittedEvents.map((event) => (
                  <Badge key={event} tone="sky">{event}</Badge>
                ))}
              </div>
            </Card>
          </div>

          <Card title="Métriques ROI" subtitle="Chaque chiffre dit comment il est produit : mesuré sur des faits, ou barème d'industrie affiché comme tel." className="mb-4">
            <ul className="space-y-2">
              {ALLO_MAUDE_AGENT.roiMetrics.map((metric) => (
                <li key={metric.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-ink-800">{metric.label}</span>
                  <Badge tone={BASIS_LABEL[metric.basis].tone}>{BASIS_LABEL[metric.basis].label}</Badge>
                  <span className="basis-full text-xs text-ink-500">{metric.method}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Diagnostic complet" subtitle="Les checks derrière le score — pass, limité, bloqué." className="mb-4">
            <ul className="space-y-1.5">
              {plan.checks.map((check) => (
                <li key={check.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={CHECK_TONE[check.status]}>{CHECK_LABEL[check.status]}</Badge>
                  <span className="font-medium text-ink-800">{check.label}</span>
                  <span className="basis-full text-xs text-ink-500 sm:basis-auto sm:flex-1">{check.detail}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Card
        title="Prompt → Agent"
        subtitle="Trois phrases de fondateur, trois drafts d'agents structurés — mêmes capabilities, mêmes ports, même validation que Maude."
        className="mb-4"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {drafts.map(({ prompt, result }) => (
            <div key={prompt} className="rounded-xl border border-ink-100 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">« {prompt} »</p>
              <p className="mt-1 text-sm font-semibold text-ink-900">{result.definition.name}</p>
              <p className="mt-1 text-xs text-ink-500">{result.definition.persona}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.suggestedCapabilities.map((cap) => (
                  <Badge key={cap.capabilityId} tone="teal">{cap.capabilityId}</Badge>
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-ink-700">Risques identifiés</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-ink-500">
                {result.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-medium text-ink-700">Première démo possible</p>
              <p className="mt-1 text-xs text-ink-500">{result.firstDemo}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-400">{drafts[0]?.result.honesty}</p>
      </Card>

      <HonestyNote>
        Console interne fondateur/démo — pas une feature client. Les drafts sont produits par un mapper
        déterministe (pas un LLM) et rien n'est déployé automatiquement : chaque agent généré doit passer la
        même validation et le même plan runtime que Maude avant d'exister pour un client.
      </HonestyNote>
    </>
  );
}
