import { describe, expect, it } from "vitest";
import { normalizeCoveragePolicy } from "@/services/coverage";

describe("normalizeCoveragePolicy", () => {
  it("conserve des modes valides et borne le délai d'overflow", () => {
    expect(normalizeCoveragePolicy({
      modes: ["after_hours", "overflow"],
      overflowDelaySec: 45,
    })).toEqual({
      modes: ["after_hours", "overflow"],
      overflowDelaySec: 45,
    });

    expect(normalizeCoveragePolicy({
      modes: ["primary"],
      overflowDelaySec: 2,
    })).toEqual({
      modes: ["primary"],
      overflowDelaySec: 5,
    });
  });

  it("rejette une politique vide ou contenant un mode inconnu", () => {
    expect(() => normalizeCoveragePolicy({
      modes: [],
      overflowDelaySec: 30,
    })).toThrow("Au moins un mode");

    expect(() => normalizeCoveragePolicy({
      modes: ["always" as "primary"],
      overflowDelaySec: 30,
    })).toThrow("Mode de couverture invalide");
  });
});
