-- Remplissage intelligent des annulations (capability appointment_gap_recovery) :
-- WaitlistEntry (« appelez-moi si une place se libère »), AppointmentGap (plage
-- libérée sans calendrier complet) et RecoveryOffer (relance prudente idempotente).
-- Additif — aucune table existante modifiée.

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "industryPackId" TEXT,
    "capabilityId" TEXT NOT NULL,
    "callerName" TEXT,
    "phone" TEXT NOT NULL,
    "sourceCallId" TEXT,
    "desiredServiceCategory" TEXT,
    "desiredServiceLabel" TEXT,
    "preferredTimeWindow" TEXT,
    "urgency" TEXT,
    "channelPreference" TEXT NOT NULL,
    "consentToSms" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentGap" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "industryPackId" TEXT,
    "capabilityId" TEXT NOT NULL,
    "serviceCategory" TEXT,
    "serviceLabel" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "humanLabel" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    CONSTRAINT "AppointmentGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryOffer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "gapId" TEXT NOT NULL,
    "waitlistEntryId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messagePreview" TEXT NOT NULL,
    "deliveryId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    CONSTRAINT "RecoveryOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_companyId_status_idx" ON "WaitlistEntry"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentGap_companyId_idempotencyKey_key" ON "AppointmentGap"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AppointmentGap_companyId_status_idx" ON "AppointmentGap"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryOffer_companyId_idempotencyKey_key" ON "RecoveryOffer"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RecoveryOffer_companyId_status_idx" ON "RecoveryOffer"("companyId", "status");

-- CreateIndex
CREATE INDEX "RecoveryOffer_companyId_gapId_idx" ON "RecoveryOffer"("companyId", "gapId");

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentGap" ADD CONSTRAINT "AppointmentGap_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryOffer" ADD CONSTRAINT "RecoveryOffer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
