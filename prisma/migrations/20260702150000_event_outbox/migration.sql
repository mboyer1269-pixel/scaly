-- Event Outbox de la frontière Scaly (ADR-020) : chaque moment métier
-- significatif (appel, transfert, consentement, opportunité, relance) devient
-- un RuntimeEvent JSON-safe, sans secret ni transcript, en attente de
-- livraison vers Oria Action Ledger. Idempotence par (companyId, dedupeKey).
-- Additif — aucune table existante modifiée.

-- CreateTable
CREATE TABLE "RuntimeEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "correlationId" TEXT NOT NULL,
    "externalId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RuntimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeEvent_companyId_dedupeKey_key" ON "RuntimeEvent"("companyId", "dedupeKey");

-- CreateIndex
CREATE INDEX "RuntimeEvent_companyId_status_idx" ON "RuntimeEvent"("companyId", "status");

-- CreateIndex
CREATE INDEX "RuntimeEvent_companyId_correlationId_idx" ON "RuntimeEvent"("companyId", "correlationId");

-- AddForeignKey
ALTER TABLE "RuntimeEvent" ADD CONSTRAINT "RuntimeEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
