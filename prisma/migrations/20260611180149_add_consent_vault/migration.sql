-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "verbatim" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sourceCallId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedVia" TEXT,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consent_companyId_phone_idx" ON "Consent"("companyId", "phone");

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
