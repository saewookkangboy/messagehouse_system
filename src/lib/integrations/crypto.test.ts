import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "./crypto";

describe("token encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a token through encrypt/decrypt in development with no secret set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTEGRATION_TOKEN_SECRET", "");
    const encrypted = encryptToken("secret-oauth-token");
    expect(decryptToken(encrypted)).toBe("secret-oauth-token");
  });

  it("round-trips a token using a configured secret", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTEGRATION_TOKEN_SECRET", "a-real-secret");
    const encrypted = encryptToken("secret-oauth-token");
    expect(decryptToken(encrypted)).toBe("secret-oauth-token");
  });

  it("throws a clear error in production when INTEGRATION_TOKEN_SECRET is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTEGRATION_TOKEN_SECRET", "");
    expect(() => encryptToken("secret-oauth-token")).toThrow(/INTEGRATION_TOKEN_SECRET/);
  });

  it("works normally in production when INTEGRATION_TOKEN_SECRET is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTEGRATION_TOKEN_SECRET", "a-real-production-secret");
    const encrypted = encryptToken("secret-oauth-token");
    expect(decryptToken(encrypted)).toBe("secret-oauth-token");
  });
});
