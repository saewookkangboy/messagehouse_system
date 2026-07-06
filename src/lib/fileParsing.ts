import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { parse as parseKoreanDoc, type ParseOptions } from "kordoc";
import { normalizeExtractedText } from "./normalizeExtractedText";

export class UnsupportedFileTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedFileTypeError";
  }
}

export class EmptyDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyDocumentError";
  }
}

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentParseError";
  }
}

export type DocFormat = "txt" | "md" | "pdf" | "docx" | "hwp" | "hwpx" | "unknown";

export function guessDocFormat(filename: string): DocFormat {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "txt":
      return "txt";
    case "md":
      return "md";
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "hwp":
      return "hwp";
    case "hwpx":
      return "hwpx";
    default:
      return "unknown";
  }
}

function finalizeExtractedText(
  text: string,
  filename: string,
  options?: { preserveMarkdown?: boolean },
): string {
  const normalized = options?.preserveMarkdown
    ? text.normalize("NFC").replace(/\r\n/g, "\n").trim()
    : normalizeExtractedText(text);
  if (normalized.trim().length === 0) {
    throw new EmptyDocumentError(
      `${filename} 파일에서 텍스트를 찾지 못했어요. 파일이 비어있어요.`,
    );
  }
  return normalized;
}

async function extractWithKordoc(
  buffer: Buffer,
  filename: string,
  options?: ParseOptions,
): Promise<string | null> {
  const result = await parseKoreanDoc(buffer, options);
  if (!result.success) {
    return null;
  }
  return finalizeExtractedText(result.markdown, filename);
}

async function extractPdfText(buffer: Buffer, filename: string): Promise<string> {
  const kordocText = await extractWithKordoc(buffer, filename, {
    removeHeaderFooter: true,
  });
  if (kordocText) return kordocText;

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return finalizeExtractedText(result.text, filename);
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer, filename: string): Promise<string> {
  const kordocText = await extractWithKordoc(buffer, filename);
  if (kordocText) return kordocText;

  const result = await mammoth.extractRawText({ buffer });
  return finalizeExtractedText(result.value, filename);
}

async function extractHwpText(buffer: Buffer, filename: string): Promise<string> {
  const result = await parseKoreanDoc(buffer, { removeHeaderFooter: true });
  if (!result.success) {
    throw new DocumentParseError(
      `${filename} 파일을 읽지 못했어요. ${result.error}`,
    );
  }
  return finalizeExtractedText(result.markdown, filename);
}

/**
 * Extracts plain text from an uploaded file. Supports TXT/MD (direct decode),
 * PDF/DOCX/HWP/HWPX (kordoc 우선, PDF/DOCX는 레거시 파서 폴백).
 */
export async function extractText(file: {
  filename: string;
  buffer: Buffer;
}): Promise<string> {
  const format = guessDocFormat(file.filename);

  try {
    switch (format) {
      case "txt":
        return finalizeExtractedText(file.buffer.toString("utf-8"), file.filename);
      case "md":
        return finalizeExtractedText(file.buffer.toString("utf-8"), file.filename, {
          preserveMarkdown: true,
        });
      case "pdf":
        return await extractPdfText(file.buffer, file.filename);
      case "docx":
        return await extractDocxText(file.buffer, file.filename);
      case "hwp":
      case "hwpx":
        return await extractHwpText(file.buffer, file.filename);
      default:
        throw new UnsupportedFileTypeError(
          `지원하지 않는 파일 형식이에요: ${file.filename}`,
        );
    }
  } catch (err) {
    if (
      err instanceof UnsupportedFileTypeError ||
      err instanceof EmptyDocumentError ||
      err instanceof DocumentParseError
    ) {
      throw err;
    }
    const label =
      format === "pdf" ? "PDF" : format === "docx" ? "DOCX" : "HWP/HWPX";
    throw new DocumentParseError(
      `${file.filename} 파일을 읽지 못했어요. ${label} 파일이 손상되지 않았는지 확인해주세요.`,
    );
  }
}
