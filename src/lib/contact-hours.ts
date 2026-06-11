/**
 * Heures de contact permises (règles CRTC télémarketing, appliquées par
 * prudence à TOUT envoi sortant planifié — pas aux réponses immédiates à un
 * appel entrant ni aux notifications au propriétaire) :
 * semaine 9 h – 21 h 30, fin de semaine 10 h – 18 h, heure LOCALE du client.
 * Hypothèse assumée : fuseau America/Toronto (clientèle QC) tant que le
 * fuseau par compagnie n'existe pas.
 */
export function isWithinContactHours(at: Date = new Date(), timeZone = "America/Toronto"): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday"); // "Mon".."Sun"
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const weekend = weekday === "Sat" || weekday === "Sun";
  return weekend ? minutes >= 10 * 60 && minutes < 18 * 60 : minutes >= 9 * 60 && minutes < 21 * 60 + 30;
}
