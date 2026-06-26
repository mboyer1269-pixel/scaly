import Link from "next/link";

export default function PublicAccountDeletionPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink-950">Suppression de compte Allô Maude</h1>
      <p className="mt-4 leading-relaxed text-ink-700">
        Les propriétaires peuvent exporter leurs données et supprimer leur compte depuis l'application Allô Maude,
        section « Confidentialité et données ». Cette suppression retire les appels, actions, consentements,
        sessions vocales, preuves et éléments de révision liés à l'entreprise.
      </p>
      <p className="mt-4 leading-relaxed text-ink-700">
        Si vous n'avez plus accès à l'application, contactez le support avec l'adresse propriétaire du compte.
        Nous ne supprimons pas de compte à partir d'une demande non vérifiée.
      </p>
      <Link
        href="/privacy"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
      >
        Ouvrir l'espace de suppression
      </Link>
    </main>
  );
}
