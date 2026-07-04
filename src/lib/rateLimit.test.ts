import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  setRateLimitStore,
  _resetRateLimitForTests,
  type RateLimitStore,
} from "./rateLimit";

describe("checkRateLimit (in-memory 기본)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    _resetRateLimitForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("윈도우 내 한도까지 허용해요", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit("k1", { limit: 5, windowMs: 60_000 })).allowed).toBe(true);
    }
  });

  it("한도 초과 시 차단하고 retryAfter를 줘요", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("k2", { limit: 5, windowMs: 60_000 });
    }
    const result = await checkRateLimit("k2", { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("윈도우가 지나면 카운트를 리셋해요", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("k3", { limit: 5, windowMs: 60_000 });
    }
    expect((await checkRateLimit("k3", { limit: 5, windowMs: 60_000 })).allowed).toBe(false);
    vi.setSystemTime(60_001);
    expect((await checkRateLimit("k3", { limit: 5, windowMs: 60_000 })).allowed).toBe(true);
  });

  it("키별로 독립 추적해요", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("a", { limit: 5, windowMs: 60_000 });
    }
    expect((await checkRateLimit("a", { limit: 5, windowMs: 60_000 })).allowed).toBe(false);
    expect((await checkRateLimit("b", { limit: 5, windowMs: 60_000 })).allowed).toBe(true);
  });
});

describe("setRateLimitStore (주입)", () => {
  afterEach(() => _resetRateLimitForTests());

  it("주입된 스토어로 위임해요 (예: Redis 어댑터)", async () => {
    const calls: string[] = [];
    const fakeRedis: RateLimitStore = {
      async hit(key) {
        calls.push(key);
        return { allowed: false, retryAfterMs: 999 };
      },
    };
    setRateLimitStore(fakeRedis);
    const res = await checkRateLimit("some-key", { limit: 10, windowMs: 1000 });
    expect(res).toEqual({ allowed: false, retryAfterMs: 999 });
    expect(calls).toEqual(["some-key"]);
  });
});
