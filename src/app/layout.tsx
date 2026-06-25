import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import { isAuthEnabled } from "@/server/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allô Maude — Réceptionniste virtuelle pour PME",
  description:
    "Allô Maude répond aux appels de votre PME, qualifie les demandes et prépare les suivis. Français québécois et anglais.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = (
    <html lang="fr">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
  return isAuthEnabled() ? <ClerkProvider localization={frFR}>{content}</ClerkProvider> : content;
}
