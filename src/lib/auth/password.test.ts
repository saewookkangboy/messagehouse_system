import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { hasMinRole } from "./types";

describe("password", () => {
  it("hashes and verifies a password", () => {
    const hash = hashPassword("test-password-123");
    expect(verifyPassword("test-password-123", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("hasMinRole", () => {
  it("ranks team roles", () => {
    expect(hasMinRole("owner", "viewer")).toBe(true);
    expect(hasMinRole("editor", "admin")).toBe(false);
    expect(hasMinRole("admin", "admin")).toBe(true);
  });
});
