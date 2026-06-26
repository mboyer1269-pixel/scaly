import type { CoverageMode, CoveragePolicy } from "@/domain/company";

const COVERAGE_MODES: CoverageMode[] = ["after_hours", "overflow", "primary"];
const MIN_OVERFLOW_DELAY_SEC = 5;
const MAX_OVERFLOW_DELAY_SEC = 120;

export const DEFAULT_COVERAGE_POLICY: CoveragePolicy = {
  modes: ["after_hours", "overflow"],
  overflowDelaySec: 20,
};

export function normalizeCoveragePolicy(input: CoveragePolicy): CoveragePolicy {
  const modes = [...new Set(input.modes)];
  if (modes.length === 0) {
    throw new Error("Au moins un mode de couverture est requis.");
  }
  const invalid = modes.find((mode) => !COVERAGE_MODES.includes(mode));
  if (invalid) {
    throw new Error(`Mode de couverture invalide : ${invalid}`);
  }

  const requestedDelay = Number.isFinite(input.overflowDelaySec)
    ? Math.round(input.overflowDelaySec)
    : DEFAULT_COVERAGE_POLICY.overflowDelaySec;

  return {
    modes,
    overflowDelaySec: Math.min(
      MAX_OVERFLOW_DELAY_SEC,
      Math.max(MIN_OVERFLOW_DELAY_SEC, requestedDelay),
    ),
  };
}
