import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendEmailProvider } from "./resend";
import { getEmailProvider, _resetEmailProviderForTests } from "./index";
import { StubEmailProvider } from "./stub";

describe("getEmailProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    _resetEmailProviderForTests();
  });

  it("defaults to StubEmailProvider when nothing is configured", () => {
    vi.stubEnv("EMAIL_PROVIDER", "");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(getEmailProvider()).toBeInstanceOf(StubEmailProvider);
  });

  it("uses ResendEmailProvider automatically when an API key is present", () => {
    vi.stubEnv("EMAIL_PROVIDER", "");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    expect(getEmailProvider()).toBeInstanceOf(ResendEmailProvider);
  });

  it("respects an explicit EMAIL_PROVIDER=stub override even with a key present", () => {
    vi.stubEnv("EMAIL_PROVIDER", "stub");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    expect(getEmailProvider()).toBeInstanceOf(StubEmailProvider);
  });

  it("throws a clear error for EMAIL_PROVIDER=resend with no key", () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(() => getEmailProvider()).toThrow(/RESEND_API_KEY/);
  });
});
