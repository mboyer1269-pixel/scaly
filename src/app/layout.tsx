import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import { isAuthEnabled } from "@/server/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allô Maude — Réceptionniste vocale bilingue pour PME",
  description:
    "Allô Maude répond aux appels de votre PME, qualifie les demandes et prépare les suivis au Québec et en Ontario. Français québécois et anglais canadien.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = isAuthEnabled()
    ? <ClerkProvider localization={frFR}>{children}</ClerkProvider>
    : children;
  return (
    <html lang="fr">
      <body className="min-h-screen font-sans">{content}</body>
    </html>
  );
}
