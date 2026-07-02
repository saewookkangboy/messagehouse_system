import { describe, expect, it, vi } from "vitest";
import { StubEmailProvider } from "./stub";

describe("StubEmailProvider", () => {
  it("reports sent: false since no real email is delivered", async () => {
    const provider = new StubEmailProvider();
    const result = await provider.send({
      to: "test@example.com",
      subject: "제목",
      text: "본문",
    });
    expect(result).toEqual({ sent: false, provider: "stub" });
  });

  it("logs the email to the console instead of sending it", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const provider = new StubEmailProvider();
    await provider.send({ to: "test@example.com", subject: "초대", text: "링크: /invite/abc" });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("test@example.com"),
    );
    logSpy.mockRestore();
  });
});
