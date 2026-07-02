import { describe, expect, it } from "vitest";
import { requestIp } from "./requestIp";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/test", { headers });
}

describe("requestIp", () => {
  it("uses the first entry of x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" });
    expect(requestIp(req)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = makeRequest({ "x-real-ip": "203.0.113.9" });
    expect(requestIp(req)).toBe("203.0.113.9");
  });

  it("falls back to a constant when no IP header is present", () => {
    const req = makeRequest({});
    expect(requestIp(req)).toBe("unknown");
  });
});
