import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("Context Pack 파이프라인 E2E", () => {
  test("업로드 → 분석 → 리서치 → 생성 → 확정 →보내기", async ({ page }) => {
    const createPromise = page.waitForResponse(
      (r) => r.url().includes("/api/context-packs") && r.request().method() === "POST",
    );
    await page.goto("/packs/new");
    const createRes = await createPromise;
    expect(createRes.ok()).toBeTruthy();

    await page.getByLabel("이슈명").fill("E2E 테스트 이슈");
    await page.getByLabel("업종").fill("보험");

    const demoFile = path.join(__dirname, "fixtures", "demo.txt");
    const uploadPromise = page.waitForResponse(
      (r) => r.url().includes("/files") && r.request().method() === "POST",
    );
    await page.locator('input[type="file"]').setInputFiles(demoFile);
    const uploadRes = await uploadPromise;
    expect(uploadRes.ok()).toBeTruthy();

    await expect(page.locator(".fileitem .fname", { hasText: "demo.txt" })).toBeVisible();

    const analyzeBtn = page.getByRole("button", { name: "분석 시작" });
    await expect(analyzeBtn).toBeEnabled({ timeout: 15_000 });
    await analyzeBtn.click();
    await expect(page).toHaveURL(/\/analysis/, { timeout: 60_000 });

    await expect(page.getByText("핵심 주제")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("자동 리서치 결과")).toBeVisible({ timeout: 90_000 });

    await page.getByRole("button", { name: "메시지하우스 생성" }).click();
    await expect(page).toHaveURL(/\/review/, { timeout: 60_000 });

    for (const gateId of ["gate1", "gate2", "gate3"] as const) {
      const patchPromise = page.waitForResponse(
        (r) => r.url().includes("/api/context-packs/") && r.request().method() === "PATCH",
      );
      await page.locator(`#${gateId}`).check();
      const patchRes = await patchPromise;
      expect(patchRes.ok()).toBeTruthy();
    }

    const confirmBtn = page.getByRole("button", { name: "Context Pack 확정" });
    await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });

    const exportPromise = page.waitForResponse(
      (r) => r.url().includes("/export") && r.request().method() === "GET" && r.ok(),
    );
    await confirmBtn.click();
    await expect(page).toHaveURL(/\/export/, { timeout: 30_000 });
    await exportPromise;

    await expect(page.getByRole("heading", { level: 1 })).toContainText("보내기");
    await expect(page.locator(".code-block.mono")).toContainText("context_pack", {
      timeout: 30_000,
    });
  });
});
