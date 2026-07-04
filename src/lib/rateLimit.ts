export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * 레이트리밋 스토어 추상화. 기본은 단일 프로세스 in-memory예요.
 * 다중 인스턴스로 수평 확장하려면 공유 스토어(Redis 등)가 담긴
 * RateLimitStore 구현을 setRateLimitStore()로 주입하세요 — 이 저장소는
 * 검증 불가한 Redis 클라이언트를 하드 의존하지 않기 위해 어댑터 주입 방식을 써요.
 */
export interface RateLimitStore {
  hit(key: string, opts: { limit: number; windowMs: number }): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** 고정 윈도우 in-memory 구현 (기본). 프로세스 간 상태 공유는 안 돼요. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();

  async hit(
    key: string,
    opts: { limit: number; windowMs: number },
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (bucket.count >= opts.limit) {
      return { allowed: false, retryAfterMs: bucket.resetAt - now };
    }
    bucket.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  clear() {
    this.buckets.clear();
  }
}

let store: RateLimitStore = new InMemoryRateLimitStore();

/** 배포 시 Redis 등 공유 스토어를 주입해요 (RateLimitStore 구현). */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  return store.hit(key, opts);
}

/** 테스트 전용 — in-memory 스토어로 리셋해요. */
export function _resetRateLimitForTests(): void {
  store = new InMemoryRateLimitStore();
}
