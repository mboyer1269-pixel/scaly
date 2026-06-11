/**
 * Adapter — Twilio Messaging (SMS réels), sans SDK (API REST + fetch).
 * Configuré quand TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_PHONE_NUMBER
 * sont présents. Sinon : non configuré, explicite — jamais de faux succès.
 */
export interface SmsResult {
  sid: string;
  to: string;
  status: string;
}

const ENV_VARS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"] as const;

export function isSmsConfigured(): boolean {
  return ENV_VARS.every((v) => Boolean(process.env[v]));
}

export function smsConfigHint(): string {
  const missing = ENV_VARS.filter((v) => !process.env[v]);
  return missing.length
    ? `Twilio Messaging incomplet — variables manquantes : ${missing.join(", ")}.`
    : "Twilio Messaging configuré.";
}

/** Envoie un SMS réel. Lève une erreur claire si non configuré ou si Twilio refuse. */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!isSmsConfigured()) throw new Error(smsConfigHint());
  const sid = process.env.TWILIO_ACCOUNT_SID as string;
  const token = process.env.TWILIO_AUTH_TOKEN as string;
  const from = process.env.TWILIO_PHONE_NUMBER as string;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio Messaging ${res.status} : ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { sid: string; to: string; status: string };
  return { sid: data.sid, to: data.to, status: data.status };
}
