/**
 * RAG 암호화 왕복 통합 테스트 — 저장은 암호문, 검색 결과는 평문임을 실 SQLite로 검증.
 * Stub 임베딩으로 네트워크 없이 돌아가요.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { indexSourceFile, retrieveRelevantChunks } from "./index";
import { encryptField, isEncrypted } from "@/lib/fieldCrypto";

const RUN = `rag-enc-${Date.now()}`;
let teamId = "";
let packId = "";
let fileId = "";

const SECRET_TEXT =
  "한화생명 미공개 내부 수치 — 심사 처리량 65% 증가, 오탐률 12%. 이 문장은 DB에 암호화되어야 해요.";

async function cleanup() {
  await db.contextPack.deleteMany({ where: { team: { name: RUN } } });
  await db.team.deleteMany({ where: { name: RUN } });
}

beforeEach(async () => {
  vi.stubEnv("EMBEDDING_PROVIDER", "stub");
  await cleanup();
  teamId = (await db.team.create({ data: { name: RUN } })).id;
  packId = (await db.contextPack.create({ data: { issue: "암호화 테스트", teamId } })).id;
  // files 라우트와 동일하게 암호화해서 저장
  const file = await db.sourceFile.create({
    data: {
      contextPackId: packId,
      filename: "secret.txt",
      mimeType: "text/plain",
      sizeBytes: SECRET_TEXT.length,
      extractedText: encryptField(SECRET_TEXT),
    },
  });
  fileId = file.id;
});

afterAll(cleanup);

describe("RAG 암호화 왕복", () => {
  it("extractedText는 DB에 암호문으로 저장돼요", async () => {
    const file = await db.sourceFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(isEncrypted(file.extractedText)).toBe(true);
    expect(file.extractedText).not.toContain("미공개");
  });

  it("인덱싱하면 청크 텍스트도 암호문으로 저장돼요", async () => {
    const count = await indexSourceFile(fileId);
    expect(count).toBeGreaterThan(0);
    const chunks = await db.documentChunk.findMany({ where: { sourceFileId: fileId } });
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(isEncrypted(c.text)).toBe(true);
      expect(c.text).not.toContain("미공개");
    }
  });

  it("검색 결과는 복호화된 평문으로 반환돼요", async () => {
    await indexSourceFile(fileId);
    const results = await retrieveRelevantChunks({
      contextPackId: packId,
      query: "심사 처리량 수치",
      teamId,
    });
    expect(results.length).toBeGreaterThan(0);
    const joined = results.map((r) => r.text).join(" ");
    expect(joined).toContain("미공개");
    expect(joined).not.toContain("enc:v1:");
  });
});
