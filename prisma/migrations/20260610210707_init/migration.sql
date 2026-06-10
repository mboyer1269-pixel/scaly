-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "sectorLabel" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "mainPhone" TEXT NOT NULL,
    "transferPhone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "languages" TEXT[],
    "defaultLanguage" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "hours" JSONB NOT NULL,
    "escalationRules" JSONB NOT NULL,
    "essentialQuestions" TEXT[],
    "services" TEXT[],
    "serviceAreas" TEXT[],
    "policies" TEXT[],
    "followUp" JSONB NOT NULL,
    "compliance" JSONB NOT NULL,
    "planId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceAgent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "languages" TEXT[],
    "greetingScript" TEXT NOT NULL,
    "closingScript" TEXT NOT NULL,
    "qualificationScriptId" TEXT NOT NULL,
    "allowedPhrases" TEXT[],
    "forbiddenPhrases" TEXT[],
    "safetyRules" TEXT[],
    "answerLimits" TEXT[],
    "transferPolicy" TEXT NOT NULL,
    "voiceProfile" JSONB NOT NULL,

    CONSTRAINT "VoiceAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "callerName" TEXT,
    "language" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "scriptId" TEXT,
    "personaId" TEXT,
    "seed" INTEGER,
    "transcript" JSONB NOT NULL,
    "intelligence" JSONB,
    "recordingUrl" TEXT,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "callId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "executor" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audit" JSONB NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "actor" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsagePeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "minutesUsed" INTEGER NOT NULL,
    "callsCount" INTEGER NOT NULL,

    CONSTRAINT "UsagePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceAgent_companyId_idx" ON "VoiceAgent"("companyId");

-- CreateIndex
CREATE INDEX "Call_companyId_startedAt_idx" ON "Call"("companyId", "startedAt");

-- CreateIndex
CREATE INDEX "Call_companyId_status_idx" ON "Call"("companyId", "status");

-- CreateIndex
CREATE INDEX "Action_companyId_status_idx" ON "Action"("companyId", "status");

-- CreateIndex
CREATE INDEX "Action_callId_idx" ON "Action"("callId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_at_idx" ON "AuditLog"("companyId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "UsagePeriod_companyId_periodLabel_key" ON "UsagePeriod"("companyId", "periodLabel");

-- AddForeignKey
ALTER TABLE "VoiceAgent" ADD CONSTRAINT "VoiceAgent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsagePeriod" ADD CONSTRAINT "UsagePeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
