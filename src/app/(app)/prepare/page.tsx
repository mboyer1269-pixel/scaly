import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { CoverageForm } from "@/components/CoverageForm";
import { RealityBadge } from "@/components/RealityBadge";
import { Card, PageHeader } from "@/components/ui";
import { resolveCompany } from "@/server/tenant";
import { getStore } from "@/server/store";
import { deriveProviderReality } from "@/services/reality";

export const dynamic = "force-dynamic";

export default async function PreparePage() {
  const company = (await resolveCompany())!;
  const agent = await getStore().getAgentByCompany(company.id);
  const checks = [
    { label: "Entreprise et territoire", ok: Boolean(company.name && company.city && company.serviceAreas.length) },
    { label: "Services et questions essentielles", ok: Boolean(company.services.length && company.essentialQuestions.length) },
    { label: "Numéro de transfert humain", ok: Boolean(company.transferPhone) },
    { label: "Politique de couverture", ok: Boolean(company.coverage?.modes.length) },
    { label: "Accueil et limites de Maude", ok: Boolean(agent?.greetingScript && agent.answerLimits.length) },
  ];
  const configured = checks.every((check) => check.ok);
  const reality = deriveProviderReality({
    configured,
    verified: false,
    detail: configured
      ? "La préparation est complète dans l'application, mais aucun appel téléphonique réel n'a encore été vérifié."
      : "Des informations requises sont encore manquantes.",
  });

  return (
    <>
      <PageHeader
        title="Préparer Maude"
        subtitle="Choisissez quand Maude répond, puis corrigez les informations qui alimentent réellement les appels."
      >
        <RealityBadge reality={reality} />
      </PageHeader>

      <div className="space-y-6">
        <Card
          title="Mode de couverture"
          subtitle="Cette politique est persistée avec l'entreprise. Son routage téléphonique externe reste à configurer et à vérifier."
        >
          <CoverageForm coverage={company.coverage} />
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="État de préparation" subtitle={`${checks.filter((check) => check.ok).length}/${checks.length} éléments configurés`}>
            <ul className="space-y-3">
              {checks.map((check) => (
                <li key={check.label} className="flex items-center gap-3 text-sm">
                  {check.ok
                    ? <CheckCircle2 size={18} className="text-emerald-600" />
                    : <CircleAlert size={18} className="text-amber-600" />}
                  <span className={check.ok ? "text-ink-800" : "font-medium text-amber-900"}>
                    {check.label}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Chemins de correction" subtitle="Aucun statut n'est bloqué sans prochaine action.">
            <div className="space-y-3">
              <Link href="/settings" className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3 text-sm font-medium text-ink-800 hover:border-scaly-300 hover:bg-scaly-50">
                Corriger les informations de l'entreprise <ArrowRight size={16} />
              </Link>
              <Link href="/agent" className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3 text-sm font-medium text-ink-800 hover:border-scaly-300 hover:bg-scaly-50">
                Ajuster l'accueil et les limites <ArrowRight size={16} />
              </Link>
              <Link href="/simulator" className="flex items-center justify-between rounded-lg bg-ink-900 px-4 py-3 text-sm font-semibold text-white hover:bg-ink-800">
                Tester un appel simulé <ArrowRight size={16} />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
