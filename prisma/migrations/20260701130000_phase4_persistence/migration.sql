-- PR #29 — persistance Phase 4 : Business Brain, notifications owner, demandes d'avis.

-- AlterTable : lien d'avis approuvé (source des demandes d'avis).
ALTER TABLE "Company" ADD COLUMN "reviewUrl" TEXT;

-- CreateTable
CREATE TABLE "BusinessKnowledgeItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "BusinessKnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerNotification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "sourceCallId" TEXT,
    "sourceTraceId" TEXT,
    "modelCostEstimateCad" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    CONSTRAINT "OwnerNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "sourceCallId" TEXT,
    "reason" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reviewUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessKnowledgeItem_companyId_status_idx" ON "BusinessKnowledgeItem"("companyId", "status");

-- CreateIndex
CREATE INDEX "OwnerNotification_companyId_status_idx" ON "OwnerNotification"("companyId", "status");

-- CreateIndex
CREATE INDEX "ReviewRequest_companyId_status_idx" ON "ReviewRequest"("companyId", "status");

-- AddForeignKey
ALTER TABLE "BusinessKnowledgeItem" ADD CONSTRAINT "BusinessKnowledgeItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerNotification" ADD CONSTRAINT "OwnerNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
