import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CUSTOMER_FILES = [
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/pricing/page.tsx",
  "src/components/Sidebar.tsx",
  "src/app/(app)/dashboard/page.tsx",
  "src/app/(app)/calls/page.tsx",
  "src/app/(app)/calls/[id]/page.tsx",
  "src/app/(app)/actions/page.tsx",
  "src/app/(app)/simulator/page.tsx",
  "src/components/SimulatorClient.tsx",
  "src/components/AgentForm.tsx",
  "src/components/OnboardingWizard.tsx",
  "src/components/SettingsForm.tsx",
];

function visibleScalyReferences(source: string): string[] {
  return source
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
    .filter((line) =>
      />[^<{]*Scaly\b/.test(line) ||
      /title\s*[:=]\s*["'`][^"'`]*Scaly\b/.test(line) ||
      /subtitle\s*[:=]\s*["'`][^"'`]*Scaly\b/.test(line) ||
      /description\s*[:=]\s*["'`][^"'`]*Scaly\b/.test(line) ||
      /["'`]Scaly\b/.test(line),
    );
}

describe("Allô Maude customer brand boundary", () => {
  it("n'expose jamais Scaly comme produit dans les surfaces client", () => {
    const violations = CUSTOMER_FILES.flatMap((path) => {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      return visibleScalyReferences(source).map((line) => `${path}: ${line.trim()}`);
    });

    expect(violations).toEqual([]);
  });
});
