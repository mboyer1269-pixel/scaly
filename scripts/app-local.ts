import { spawn } from "node:child_process";
import { resolveLocalPort } from "../src/services/local-launch";

const forwardedArgs = process.argv.slice(2);
const portArgPresent = forwardedArgs.some((arg) => arg === "--port" || arg.startsWith("--port="));
const nextArgs = ["run", "dev", "--", "--hostname", "127.0.0.1"];
if (!portArgPresent && process.env.PORT) nextArgs.push("--port", process.env.PORT);
nextArgs.push(...forwardedArgs);
const port = resolveLocalPort(forwardedArgs, process.env.PORT);

console.log("\nALLÔ MAUDE — APPLICATION LOCALE");
console.log("Mode de persistance : mémoire de processus (réinitialisée au redémarrage)");
console.log(`URL : http://127.0.0.1:${port}`);
console.log("Les appels de la démo sont simulés. Les appels téléphoniques réels restent séparés.\n");

const npmExecPath = process.env.npm_execpath;
const child = npmExecPath
  ? spawn(process.execPath, [npmExecPath, ...nextArgs], {
    stdio: "inherit",
    env: {
      ...process.env,
      STORE_PROVIDER: "memory",
    },
  })
  : spawn(process.platform === "win32" ? "npm.cmd" : "npm", nextArgs, {
    shell: process.platform === "win32",
    stdio: "inherit",
    env: {
      ...process.env,
      STORE_PROVIDER: "memory",
    },
  });

child.on("error", (error) => {
  console.error(`Impossible de lancer l'application locale : ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
