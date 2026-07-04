/**
 * 보존 정책 — 보존 기간 지난 SourceFile만 삭제되는지 실 SQLite로 검증.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { purgeExpiredSourceFiles } from "./retention";

const RUN = `retention-${Date.now()}`;
let packId = "";

async function cleanup() {
  await db.contextPack.deleteMany({ where: { team: { name: RUN } } });
  await db.team.deleteMany({ where: { name: RUN } });
}

async function makeFile(daysAgo: number) {
  const created = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return db.sourceFile.create({
    data: {
      contextPackId: packId,
      filename: `f-${daysAgo}d.txt`,
      mimeType: "text/plain",
      sizeBytes: 10,
      extractedText: "내용",
      createdAt: created,
    },
  });
}

beforeEach(async () => {
  await cleanup();
  const teamId = (await db.team.create({ data: { name: RUN } })).id;
  packId = (await db.contextPack.create({ data: { issue: "보존 테스트", teamId } })).id;
});

afterAll(cleanup);

describe("purgeExpiredSourceFiles", () => {
  it("보존 기간(30일)이 지난 파일만 삭제해요", async () => {
    const old1 = await makeFile(40);
    const old2 = await makeFile(31);
    const recent = await makeFile(10);

    const { deleted } = await purgeExpiredSourceFiles(30);
    expect(deleted).toBe(2);

    expect(await db.sourceFile.findUnique({ where: { id: old1.id } })).toBeNull();
    expect(await db.sourceFile.findUnique({ where: { id: old2.id } })).toBeNull();
    expect(await db.sourceFile.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it("파일 삭제 시 DocumentChunk도 Cascade로 지워져요", async () => {
    const old = await makeFile(40);
    await db.documentChunk.create({
      data: {
        sourceFileId: old.id,
        contextPackId: packId,
        chunkIndex: 0,
        text: "청크",
        embedding: "[]",
        model: "stub",
      },
    });
    await purgeExpiredSourceFiles(30);
    expect(await db.documentChunk.count({ where: { sourceFileId: old.id } })).toBe(0);
  });

  it("커스텀 보존 기간을 존중해요", async () => {
    await makeFile(5);
    const { deleted } = await purgeExpiredSourceFiles(3);
    expect(deleted).toBe(1);
  });

  it("삭제 대상이 없으면 0을 반환해요", async () => {
    await makeFile(1);
    const { deleted } = await purgeExpiredSourceFiles(30);
    expect(deleted).toBe(0);
  });
});
