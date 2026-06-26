ALTER TABLE "Company"
ADD COLUMN "businessDescription" TEXT;

ALTER TABLE "VoiceAgent"
ADD COLUMN "ownerInstructions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
