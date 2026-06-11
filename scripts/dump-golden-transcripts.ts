/**
 * Outil d'annotation — dump compact des 53 appels seed pour annotation humaine
 * du golden set (intention + urgence). N'affiche PAS la sortie de rules-v1 :
 * l'annotation doit se faire à l'aveugle pour ne pas être circulaire.
 * Usage : npx tsx scripts/dump-golden-transcripts.ts > golden-dump.json
 */
import { buildSeedData } from "../src/server/seed";
import { goldenKey } from "../src/data/golden-set";

const seed = buildSeedData();
const dump = seed.calls.map((c) => ({
  key: goldenKey(c),
  status: c.status,
  lang: c.language,
  persona: c.personaId ?? null,
  script: c.scriptId ?? null,
  caller: c.transcript.filter((t) => t.speaker === "caller").map((t) => t.text).join(" / "),
}));
console.log(JSON.stringify(dump, null, 1));
