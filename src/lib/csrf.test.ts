import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./csrf";

describe("isSameOrigin", () => {
  it("always allows safe methods regardless of headers", () => {
    expect(
      isSameOrigin({
        method: "GET",
        originHeader: "https://evil.example.com",
        refererHeader: null,
        requestOrigin: "https://app.example.com",
      }),
    ).toBe(true);
  });

  it("allows a state-changing request when Origin matches", () => {
    expect(
      isSameOrigin({
        method: "POST",
        originHeader: "https://app.example.com",
        refererHeader: null,
        requestOrigin: "https://app.example.com",
      }),
    ).toBe(true);
  });

  it("blocks a state-changing request when Origin doesn't match", () => {
    expect(
      isSameOrigin({
        method: "POST",
        originHeader: "https://evil.example.com",
        refererHeader: null,
        requestOrigin: "https://app.example.com",
      }),
    ).toBe(false);
  });

  it("falls back to Referer when Origin is absent", () => {
    expect(
      isSameOrigin({
        method: "DELETE",
        originHeader: null,
        refererHeader: "https://app.example.com/settings/team",
        requestOrigin: "https://app.example.com",
      }),
    ).toBe(true);
    expect(
      isSameOrigin({
        method: "DELETE",
        originHeader: null,
        refererHeader: "https://evil.example.com/",
        requestOrigin: "https://app.example.com",
      }),
    ).toBe(false);
  });

  it("allows the request when neither Origin nor Referer is present", () => {
    expect(
      isSameOrigin({
        method: "PATCH",
        originHeader: null,
        refererHeader: null,
        requestOrigin: "https://app.example.com",
      }),
    ).toBe(true);
  });

  it("blocks when Referer is present but malformed", () => {
    expect(
      isSameOrigin({
        method: "POST",
        originHeader: null,
        refererHeader: "not-a-url",
        requestOrigin: "https://app.example.com",
      }),
    ).toBe(false);
  });
});
