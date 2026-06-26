ALTER TABLE "Company" ADD COLUMN "coverage" JSONB;

CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReadinessEvidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "callId" TEXT,
    "externalId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReadinessEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReviewItem_companyId_status_createdAt_idx" ON "ReviewItem"("companyId", "status", "createdAt");
CREATE INDEX "ReviewItem_callId_idx" ON "ReviewItem"("callId");
CREATE INDEX "ReadinessEvidence_companyId_kind_createdAt_idx" ON "ReadinessEvidence"("companyId", "kind", "createdAt");
CREATE INDEX "ReadinessEvidence_callId_idx" ON "ReadinessEvidence"("callId");

ALTER TABLE "ReviewItem"
ADD CONSTRAINT "ReviewItem_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReadinessEvidence"
ADD CONSTRAINT "ReadinessEvidence_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
