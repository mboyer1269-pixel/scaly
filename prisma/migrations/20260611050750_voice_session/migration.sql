-- CreateTable
CREATE TABLE "VoiceSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "status" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "turns" JSONB NOT NULL,
    "events" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "telemetry" JSONB NOT NULL,
    "callId" TEXT,

    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceSession_companyId_startedAt_idx" ON "VoiceSession"("companyId", "startedAt");
