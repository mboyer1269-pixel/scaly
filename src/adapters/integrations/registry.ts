/**
 * Integrations Hub — registre déclaratif.
 * Statuts honnêtes : "mock_fonctionnel" = un exécuteur mock journalise l'action ;
 * "planifie" = aucune ligne de code d'intégration n'existe encore.
 * L'architecture (ActionExecutor + payloads typés) permet de brancher chaque
 * intégration réelle sans toucher à l'Action Engine ni à l'UI.
 */
import type { IntegrationDef } from "@/domain/integration";

export const INTEGRATIONS: IntegrationDef[] = [
  // Calendriers
  { id: "google_calendar", label: "Google Calendar", category: "calendrier", status: "mock_fonctionnel", capabilities: ["Créer un événement", "Vérifier les disponibilités"], phase: "P3" },
  { id: "outlook_calendar", label: "Outlook Calendar", category: "calendrier", status: "planifie", capabilities: ["Créer un événement"], phase: "P3" },
  // Courriel
  { id: "gmail", label: "Gmail", category: "courriel", status: "mock_fonctionnel", capabilities: ["Envoyer résumé d'appel", "Résumé quotidien"], phase: "P3" },
  { id: "outlook_email", label: "Outlook Email", category: "courriel", status: "planifie", capabilities: ["Envoyer résumé d'appel"], phase: "P3" },
  // SMS
  { id: "twilio_sms", label: "SMS (Twilio)", category: "sms", status: "mock_fonctionnel", capabilities: ["Confirmation RDV", "Rappel appel manqué", "Alerte urgence"], phase: "P3" },
  // CRM
  { id: "hubspot", label: "HubSpot", category: "crm", status: "mock_fonctionnel", capabilities: ["Créer lead", "Tags", "Valeur estimée"], phase: "P3" },
  { id: "pipedrive", label: "Pipedrive", category: "crm", status: "planifie", capabilities: ["Créer lead"], phase: "P3" },
  { id: "zoho", label: "Zoho CRM", category: "crm", status: "planifie", capabilities: ["Créer lead"], phase: "P3" },
  { id: "salesforce", label: "Salesforce", category: "crm", status: "planifie", capabilities: ["Créer lead", "Objets custom"], phase: "P3" },
  // Paiement
  { id: "stripe", label: "Stripe", category: "paiement", status: "planifie", capabilities: ["Abonnements", "Minutes excédentaires", "Frais d'installation"], phase: "P3" },
  // Automatisation
  { id: "webhook", label: "Webhooks custom", category: "automatisation", status: "mock_fonctionnel", capabilities: ["POST signé par événement d'appel"], phase: "P3" },
  { id: "zapier", label: "Zapier", category: "automatisation", status: "planifie", capabilities: ["Déclencheurs d'appel"], phase: "P3" },
  { id: "make", label: "Make", category: "automatisation", status: "planifie", capabilities: ["Déclencheurs d'appel"], phase: "P3" },
  { id: "n8n", label: "n8n", category: "automatisation", status: "planifie", capabilities: ["Déclencheurs d'appel"], phase: "P3" },
  // Communication interne
  { id: "slack", label: "Slack", category: "communication", status: "planifie", capabilities: ["Alerte urgence", "Résumé quotidien dans un canal"], phase: "P3" },
  { id: "teams", label: "Microsoft Teams", category: "communication", status: "planifie", capabilities: ["Alerte urgence"], phase: "P3" },
];
