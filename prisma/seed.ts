/**
 * Seed Postgres — injecte buildSeedData() (les mêmes données déterministes que
 * la démo in-memory) dans la base. Destructif : vide les tables avant insertion.
 * Usage : npm run db:seed (nécessite DATABASE_URL).
 */
import { prisma } from "../src/server/prisma";
import { buildSeedData } from "../src/server/seed";
import { actionToDb, agentToDb, callToDb, companyToDb } from "../src/server/prisma-store";

async function main() {
  const seed = buildSeedData();

  console.log("Nettoyage des tables…");
  await prisma.$transaction([
    prisma.action.deleteMany(),
    prisma.call.deleteMany(),
    prisma.voiceAgent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.usagePeriod.deleteMany(),
    prisma.company.deleteMany(),
  ]);

  console.log(`Insertion : ${seed.companies.length} entreprises, ${seed.agents.length} agents, ${seed.calls.length} appels, ${seed.actions.length} actions…`);
  for (const c of seed.companies) {
    await prisma.company.create({ data: companyToDb(c) });
  }
  await prisma.voiceAgent.createMany({ data: seed.agents.map(agentToDb) });
  await prisma.call.createMany({ data: seed.calls.map(callToDb) });
  await prisma.action.createMany({ data: seed.actions.map(actionToDb) });
  await prisma.auditLog.create({
    data: {
      actor: "system",
      event: "seed_chargé",
      detail: `${seed.calls.length} appels, ${seed.actions.length} actions (données de démonstration, seed déterministe)`,
    },
  });

  const counts = {
    companies: await prisma.company.count(),
    agents: await prisma.voiceAgent.count(),
    calls: await prisma.call.count(),
    actions: await prisma.action.count(),
  };
  console.log("Seed terminé :", counts);
}

main()
  .catch((err) => {
    console.error("Échec du seed :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
