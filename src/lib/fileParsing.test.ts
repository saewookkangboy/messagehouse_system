import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DocumentParseError,
  extractText,
  guessDocFormat,
  UnsupportedFileTypeError,
} from "./fileParsing";

const fixturesDir = path.join(__dirname, "fixtures");

describe("guessDocFormat", () => {
  it.each([
    ["report.txt", "txt"],
    ["report.TXT", "txt"],
    ["notes.md", "md"],
    ["press-release.pdf", "pdf"],
    ["slides.docx", "docx"],
    ["brief.hwp", "hwp"],
    ["brief.hwpx", "hwpx"],
    ["archive.zip", "unknown"],
    ["no-extension", "unknown"],
  ] as const)("classifies %s as %s", (filename, expected) => {
    expect(guessDocFormat(filename)).toBe(expected);
  });
});

describe("extractText", () => {
  it("decodes a .txt buffer as UTF-8 text", async () => {
    const buffer = Buffer.from("한화생명 신상품 출시 보도자료입니다.", "utf-8");
    const text = await extractText({ filename: "press.txt", buffer });
    expect(text).toBe("한화생명 신상품 출시 보도자료입니다.");
  });

  it("decodes a .md buffer as UTF-8 text", async () => {
    const buffer = Buffer.from("# 제목\n\n본문 내용", "utf-8");
    const text = await extractText({ filename: "notes.md", buffer });
    expect(text).toContain("# 제목");
  });

  it("throws UnsupportedFileTypeError for an unrecognized extension", async () => {
    await expect(
      extractText({ filename: "archive.zip", buffer: Buffer.from("x") }),
    ).rejects.toThrow(UnsupportedFileTypeError);
  });

  it("extracts text from a real PDF file", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.pdf"));
    const text = await extractText({ filename: "press.pdf", buffer });
    expect(text).toContain("MessageHouse Test Document");
    expect(text).toContain("Revenue target");
    expect(text).toContain("12 billion won");
    expect(text).not.toContain("1 of 1");
  });

  it("extracts Korean text from a real DOCX file", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.docx"));
    const text = await extractText({ filename: "slides.docx", buffer });
    expect(text).toContain("메시지하우스 테스트 문서");
    expect(text).toContain("매출 목표 120억원");
    expect(text).toContain("성장률 15%");
  });

  it("throws DocumentParseError with a clear message for a corrupt PDF", async () => {
    await expect(
      extractText({ filename: "press.pdf", buffer: Buffer.from("not a real pdf") }),
    ).rejects.toThrow(DocumentParseError);
  });

  it("throws DocumentParseError with a clear message for a corrupt DOCX", async () => {
    await expect(
      extractText({ filename: "slides.docx", buffer: Buffer.from("not a real docx") }),
    ).rejects.toThrow(DocumentParseError);
  });

  it("throws on an empty or whitespace-only text file", async () => {
    await expect(
      extractText({ filename: "empty.txt", buffer: Buffer.from("   \n\t  ") }),
    ).rejects.toThrow(/비어있어요|empty/i);
  });
});
