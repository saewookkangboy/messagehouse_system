import type { AiProvider } from "./schema";
import { StubAiProvider } from "./stub";
import { ClaudeAiProvider } from "./claude";
import { GeminiAiProvider } from "./gemini";

export * from "./schema";
export { AiResponseParseError } from "./parseAiJson";

let cached: AiProvider | undefined;

/**
 * Selection order:
 * - AI_PROVIDER=stub   -> always the canned demo data (no network, no key)
 * - AI_PROVIDER=claude -> always the real Claude API (throws if no key)
 * - AI_PROVIDER=gemini -> always the real Gemini API (throws if no key)
 * - unset              -> ANTHROPIC_API_KEY if present, else GEMINI_API_KEY,
 *                         else stub
 *
 * Defaulting to stub when nothing is configured means `npm run dev` works
 * immediately with zero setup; set ANTHROPIC_API_KEY or GEMINI_API_KEY to
 * get real analysis.
 */
export function getAiProvider(): AiProvider {
  if (cached) return cached;

  const mode = process.env.AI_PROVIDER;
  if (mode === "stub") {
    cached = new StubAiProvider();
  } else if (mode === "claude") {
    cached = new ClaudeAiProvider();
  } else if (mode === "gemini") {
    cached = new GeminiAiProvider();
  } else if (process.env.ANTHROPIC_API_KEY) {
    cached = new ClaudeAiProvider();
  } else if (process.env.GEMINI_API_KEY) {
    cached = new GeminiAiProvider();
  } else {
    cached = new StubAiProvider();
  }
  return cached;
}

/** Test-only escape hatch to reset the memoized provider between runs. */
export function _resetAiProviderForTests(): void {
  cached = undefined;
}
