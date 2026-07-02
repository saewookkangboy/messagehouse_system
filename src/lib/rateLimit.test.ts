import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, _resetRateLimitForTests } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    _resetRateLimitForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("k1", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("blocks the request once the limit is exceeded", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("k2", { limit: 5, windowMs: 60_000 });
    }
    const result = checkRateLimit("k2", { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets the count once the window elapses", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("k3", { limit: 5, windowMs: 60_000 });
    }
    expect(checkRateLimit("k3", { limit: 5, windowMs: 60_000 }).allowed).toBe(false);

    vi.setSystemTime(60_001);
    expect(checkRateLimit("k3", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("a", { limit: 5, windowMs: 60_000 });
    }
    expect(checkRateLimit("a", { limit: 5, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkRateLimit("b", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });
});
