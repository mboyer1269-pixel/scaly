/**
 * `npm run security:check` — scanner anti-secret minimal (P0 sécurité).
 *
 * Vérifie que les fichiers SUIVIS PAR GIT ne contiennent aucun secret réel :
 *  - aucun fichier .env réel tracké (.env.example est permis) ;
 *  - aucun motif de credential connu (URL Postgres avec mot de passe, clé
 *    OpenAI/Clerk/Stripe/Twilio, mot de passe Neon npg_…) dans le contenu.
 *
 * HONNÊTETÉ : c'est un filet local rapide, pas un remplacement de gitleaks ou
 * du secret scanning GitHub. Il attrape l'erreur naïve (coller une vraie clé
 * dans un fichier committé) AVANT qu'elle parte dans l'historique.
 *
 * Sortie : liste des trouvailles (fichier:ligne, motif — JAMAIS la valeur),
 * code 1 si au moins un secret est détecté, sinon 0.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Motifs de secrets réels. Le nom est affiché, jamais la valeur capturée. */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  // URL Postgres avec un vrai mot de passe (jamais dans un fichier tracké).
  { name: "URL Postgres avec credentials", re: /postgres(?:ql)?:\/\/\w+:[^@\s"']{4,}@/ },
  // Mot de passe Neon (préfixe stable npg_).
  { name: "Mot de passe Neon (npg_…)", re: /npg_[A-Za-z0-9]{8,}/ },
  { name: "Clé OpenAI (sk-…)", re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: "Clé secrète Clerk (sk_live/sk_test)", re: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { name: "Clé Stripe (rk_live/whsec)", re: /\b(?:rk_live|whsec)_[A-Za-z0-9]{16,}/ },
  // SID de compte Twilio accompagné d'un token sur la même ligne, ou auth token assigné en dur.
  { name: "Twilio auth token en dur", re: /TWILIO_AUTH_TOKEN\s*[=:]\s*["']?[a-f0-9]{32}\b/i },
  { name: "Clé ElevenLabs en dur", re: /ELEVENLABS_API_KEY\s*[=:]\s*["']?[A-Za-z0-9]{20,}/ },
];

/** Fichiers .env réels — interdits dans l'index git, peu importe le contenu. */
const FORBIDDEN_ENV_FILE = /(^|\/)\.env(\.local|\.production|\.development)?$/;

/** Fichiers où un motif est attendu et sans danger (exemples vides, ce scanner, sa doc). */
const ALLOWED_FILES = new Set([
  "scripts/security-check.ts",
  "docs/SECURITY_READINESS.md",
  "SECURITY_ROTATION_REQUIRED.md",
]);

function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function isBinaryLike(path: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|woff2?|ttf|eot|mp3|wav)$/i.test(path);
}

function main(): void {
  const files = trackedFiles();
  const findings: string[] = [];

  for (const file of files) {
    if (FORBIDDEN_ENV_FILE.test(file) && !file.endsWith(".env.example")) {
      findings.push(`${file} — fichier .env réel suivi par git (interdit)`);
      continue;
    }
    if (ALLOWED_FILES.has(file) || isBinaryLike(file)) continue;

    let content: string;
    try {
      content = readFileSync(join(root, file), "utf8");
    } catch {
      continue; // fichier supprimé/illisible : rien à scanner
    }
    const lines = content.split("\n");
    for (const { name, re } of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i += 1) {
        if (re.test(lines[i])) {
          findings.push(`${file}:${i + 1} — ${name}`);
        }
      }
    }
  }

  if (findings.length > 0) {
    console.error("❌ SECRETS DÉTECTÉS dans des fichiers suivis par git :\n");
    for (const f of findings) console.error(`   • ${f}`);
    console.error("\nRetirez le secret, faites-en la ROTATION (il est compromis), puis re-lancez.");
    process.exit(1);
  }
  console.log(`✅ security:check — ${files.length} fichiers trackés scannés, aucun secret détecté.`);
}

main();
