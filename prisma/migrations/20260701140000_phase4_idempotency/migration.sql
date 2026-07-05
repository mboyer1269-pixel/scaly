-- PR #33 — idempotence appel (provenance) + verrou de livraison non-terminal.

-- Idempotence : persiste la provenance de l'appel (ex. callSid Twilio).
ALTER TABLE "Call" ADD COLUMN "provenance" JSONB;

-- Verrou de livraison des notifications owner : réservation sans marquer `sent`.
ALTER TABLE "OwnerNotification" ADD COLUMN "deliveryClaimedAt" TIMESTAMP(3);
