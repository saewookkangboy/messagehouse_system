import type { EmailProvider } from "./schema";
import { StubEmailProvider } from "./stub";
import { ResendEmailProvider } from "./resend";

export * from "./schema";

let cached: EmailProvider | undefined;

/**
 * Selection order:
 * - EMAIL_PROVIDER=stub   -> logs only, no network, no key
 * - EMAIL_PROVIDER=resend -> always the real Resend API (throws if no key)
 * - unset                 -> RESEND_API_KEY if present, else stub
 */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const mode = process.env.EMAIL_PROVIDER;
  if (mode === "stub") {
    cached = new StubEmailProvider();
  } else if (mode === "resend") {
    cached = new ResendEmailProvider();
  } else if (process.env.RESEND_API_KEY) {
    cached = new ResendEmailProvider();
  } else {
    cached = new StubEmailProvider();
  }
  return cached;
}

/** Test-only escape hatch to reset the memoized provider between runs. */
export function _resetEmailProviderForTests(): void {
  cached = undefined;
}
