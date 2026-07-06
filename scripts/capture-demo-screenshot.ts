import path from "node:path";
import { chromium, expect } from "@playwright/test";

const BASE = "http://localhost:3099";
const OUT_DIR = path.join(__dirname, "..", "docs", "screenshots");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/packs/new`);

  await page.waitForSelector("#issue", { timeout: 30_000 });
  await page.locator("#issue").fill("AI 언더라이팅 신상품 출시");
  await page.locator("#industry").fill("보험");

  const demoFile = path.join(__dirname, "..", "e2e", "fixtures", "demo.txt");
  const createPromise = page.waitForResponse(
    (r) => r.url().includes("/api/context-packs") && r.request().method() === "POST",
  );
  const uploadPromise = page.waitForResponse(
    (r) => r.url().includes("/files") && r.request().method() === "POST",
  );
  await page.locator('input[type="file"]').setInputFiles(demoFile);
  const [createRes, uploadRes] = await Promise.all([createPromise, uploadPromise]);
  if (!createRes.ok()) throw new Error(`Pack create failed: ${createRes.status()}`);
  if (!uploadRes.ok()) throw new Error(`Upload failed: ${uploadRes.status()}`);

  await page.locator(".fileitem .fname", { hasText: "demo.txt" }).waitFor({ timeout: 15_000 });

  const analyzeBtn = page.getByRole("button", { name: "분석 시작" });
  await expect(analyzeBtn).toBeEnabled({ timeout: 15_000 });
  await analyzeBtn.click();

  await page.waitForURL(/\/analysis/, { timeout: 60_000 });
  await page.getByText("핵심 주제").waitFor({ timeout: 90_000 });
  await page.getByText("자동 리서치 결과").waitFor({ timeout: 90_000 });

  await page.getByRole("button", { name: "메시지하우스 생성" }).click();
  await page.waitForURL(/\/review/, { timeout: 60_000 });
  await page.getByText("지붕 · Roof").waitFor({ timeout: 30_000 });

  await page.screenshot({
    path: path.join(OUT_DIR, "messagehouse-review-demo.png"),
    fullPage: true,
  });

  for (const gateId of ["gate1", "gate2", "gate3"] as const) {
    await page.locator(`#${gateId}`).check();
  }
  await page.getByRole("button", { name: "Context Pack 확정" }).click();
  await page.waitForURL(/\/export/, { timeout: 30_000 });
  await page.getByRole("heading", { level: 1, name: "Context Pack 보내기" }).waitFor();
  await page.locator(".code-block.mono").filter({ hasText: "context_pack" }).waitFor({
    timeout: 30_000,
  });

  await page.screenshot({
    path: path.join(OUT_DIR, "messagehouse-export-demo.png"),
    fullPage: true,
  });

  await browser.close();
  console.log("Saved:", path.join(OUT_DIR, "messagehouse-review-demo.png"));
  console.log("Saved:", path.join(OUT_DIR, "messagehouse-export-demo.png"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
