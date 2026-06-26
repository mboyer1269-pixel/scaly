import { describe, expect, it } from "vitest";
import { resolveLocalPort } from "@/services/local-launch";

describe("resolveLocalPort", () => {
  it("préfère le port transmis à la commande", () => {
    expect(resolveLocalPort(["--port", "3017"], "4000")).toBe("3017");
    expect(resolveLocalPort(["--port=3018"], "4000")).toBe("3018");
  });

  it("utilise PORT puis 3000 par défaut", () => {
    expect(resolveLocalPort([], "4000")).toBe("4000");
    expect(resolveLocalPort([])).toBe("3000");
  });
});
