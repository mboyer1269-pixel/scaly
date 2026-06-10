import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scaly — Réceptionniste vocale IA pour PME",
  description:
    "Scaly répond aux appels de votre PME, qualifie les demandes, déclenche les suivis et mesure la valeur sauvée. FR-QC + EN.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
