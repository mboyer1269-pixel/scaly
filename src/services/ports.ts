/**
 * Ports de l'écosystème (ADR-020) — la frontière substituable, sans couplage.
 *
 * Deux contrats, deux implémentations locales, zéro dépendance réseau :
 *  - ActionLedgerPort   : où vont les faits business. Aujourd'hui : l'outbox
 *    local (OutboxOnlyActionLedger). Demain : OriaActionLedgerClient — même
 *    signature, les émetteurs ne changent pas.
 *  - ContextPackProvider : d'où vient le contexte d'appel. Aujourd'hui : le
 *    caller-memory local (LocalContextPackProvider). Demain :
 *    MemexContextPackProvider — /api/voice/context ne change pas.
 *
 * Important : on ne branche AUCUNE vraie dépendance Oria/Memex ici. Le but est
 * une frontière claire, testée, substituable — pas un framework.
 */
import type { CallerMemory } from "@/domain/caller";
import type { RuntimeEvent } from "@/domain/runtime-event";
import { getStore } from "@/server/store";
import { buildCallerMemory, selectCallerHistory } from "@/services/caller-memory";

// ─── Action Ledger ──────────────────────────────────────────────────────────

export interface ActionLedgerPort {
  /** Appende un événement déjà persisté dans l'outbox vers le ledger externe. */
  appendEvent(event: RuntimeEvent): Promise<void>;
}

/**
 * Implémentation actuelle : no-op assumé. L'événement EST déjà dans l'outbox
 * local (source de vérité de la frontière) ; ce port ne fait rien de plus tant
 * qu'Oria n'existe pas. Les événements restent `pending` — honnête et visible.
 */
export class OutboxOnlyActionLedger implements ActionLedgerPort {
  async appendEvent(_event: RuntimeEvent): Promise<void> {
    // Volontairement vide : l'outbox local est la file d'attente.
    // OriaActionLedgerClient implémentera ce contrat (HTTP + auth) sans
    // toucher aux émetteurs ni au repo.
  }
}

export function getActionLedger(): ActionLedgerPort {
  const g = globalThis as { __scalyActionLedger?: ActionLedgerPort };
  if (!g.__scalyActionLedger) g.__scalyActionLedger = new OutboxOnlyActionLedger();
  return g.__scalyActionLedger;
}

// ─── Context Pack ───────────────────────────────────────────────────────────

/**
 * Le dossier de contexte fourni au runtime vocal au début d'un appel.
 * v1 : exactement ce que /api/voice/context sait déjà construire. Les champs
 * futurs (préférences cross-canal, notes Memex) s'ajouteront ici sans casser
 * les consommateurs.
 */
export interface ContextPack {
  /** D'où vient ce contexte — honnêteté sur la source. */
  source: "scaly-local" | "memex";
  callerMemory?: CallerMemory;
}

export interface ContextPackProvider {
  getContextPack(companyId: string, callerPhone: string): Promise<ContextPack>;
}

/**
 * Implémentation actuelle : dérive le dossier appelant des appels locaux du
 * tenant (caller-memory existant, gardes anti-croisement de tenant incluses).
 */
export class LocalContextPackProvider implements ContextPackProvider {
  async getContextPack(companyId: string, callerPhone: string): Promise<ContextPack> {
    const calls = await getStore().listCalls(companyId);
    const callerMemory = buildCallerMemory(selectCallerHistory(calls, companyId, callerPhone));
    return { source: "scaly-local", ...(callerMemory ? { callerMemory } : {}) };
  }
}

export function getContextPackProvider(): ContextPackProvider {
  const g = globalThis as { __scalyContextPack?: ContextPackProvider };
  if (!g.__scalyContextPack) g.__scalyContextPack = new LocalContextPackProvider();
  return g.__scalyContextPack;
}
