-- PR3 — routage multi-tenant des webhooks Twilio.
ALTER TABLE "Company" ADD COLUMN "twilioPhoneNumber" TEXT;

CREATE UNIQUE INDEX "Company_twilioPhoneNumber_key" ON "Company"("twilioPhoneNumber");
