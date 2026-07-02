/**
 * Plafond dur de durée par appel — contrôle des coûts du pont realtime.
 * L'expiration déclenche le transfert humain ; stop() (fin d'appel normale)
 * désarme définitivement. Jamais de double déclenchement.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCallCap, maxCallSecondsFromEnv, DEFAULT_MAX_CALL_SECONDS } from "../realtime/call-cap";

afterEach(() => {
  vi.useRealTimers();
});

describe("createCallCap", () => {
  it("déclenche onExpire exactement une fois au plafond", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const cap = createCallCap(900, onExpire);

    cap.start();
    cap.start(); // double armement = no-op, pas de deuxième chrono
    vi.advanceTimersByTime(899_000);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(900_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("stop() avant le plafond : l'expiration ne se déclenche jamais (fin d'appel normale)", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const cap = createCallCap(900, onExpire);

    cap.start();
    vi.advanceTimersByTime(500_000);
    cap.stop();
    vi.advanceTimersByTime(2_000_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("0 seconde = plafond désactivé explicitement", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const cap = createCallCap(0, onExpire);

    cap.start();
    vi.advanceTimersByTime(10_000_000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});

describe("maxCallSecondsFromEnv", () => {
  it("défaut conservateur 15 min, valeur valide respectée, 0 = désactivé, invalide → défaut", () => {
    expect(maxCallSecondsFromEnv({})).toBe(DEFAULT_MAX_CALL_SECONDS);
    expect(DEFAULT_MAX_CALL_SECONDS).toBe(900);
    expect(maxCallSecondsFromEnv({ SCALY_MAX_CALL_SECONDS: "300" })).toBe(300);
    expect(maxCallSecondsFromEnv({ SCALY_MAX_CALL_SECONDS: "0" })).toBe(0);
    expect(maxCallSecondsFromEnv({ SCALY_MAX_CALL_SECONDS: "abc" })).toBe(DEFAULT_MAX_CALL_SECONDS);
    expect(maxCallSecondsFromEnv({ SCALY_MAX_CALL_SECONDS: "-5" })).toBe(DEFAULT_MAX_CALL_SECONDS);
  });
});
