/**
 * Purge Loi 25 — CLI locale (équivalent du cron /api/cron/purge).
 * Usage : npm run db:purge  (respecte STORE_PROVIDER / DATABASE_URL de .env)
 */
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

async function main() {
  const { getStore } = await import("../src/server/store");
  const store = getStore();
  console.log(`Purge des transcripts expirés (store: ${store.info().provider})…`);
  const result = await store.purgeExpiredTranscripts();
  console.log(`Terminé : ${result.purged} transcript(s) purgé(s).`);
}

main().catch((err) => {
  console.error("Échec de la purge :", err);
  process.exitCode = 1;
});
