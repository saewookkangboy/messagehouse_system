import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { parse as parseKoreanDoc } from "kordoc";

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

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractHwpText(buffer: Buffer, filename: string): Promise<string> {
  const result = await parseKoreanDoc(buffer);
  if (!result.success) {
    throw new DocumentParseError(
      `${filename} 파일을 읽지 못했어요. ${result.error}`,
    );
  }
  return result.markdown;
}

/**
 * Extracts plain text from an uploaded file. Supports TXT/MD (direct decode),
 * PDF/DOCX (via pdf-parse / mammoth), and HWP/HWPX (via kordoc).
 */
export async function extractText(file: {
  filename: string;
  buffer: Buffer;
}): Promise<string> {
  const format = guessDocFormat(file.filename);

  let text: string;
  switch (format) {
    case "txt":
    case "md":
      text = file.buffer.toString("utf-8");
      break;
    case "pdf":
      try {
        text = await extractPdfText(file.buffer);
      } catch {
        throw new DocumentParseError(
          `${file.filename} 파일을 읽지 못했어요. PDF 파일이 손상되지 않았는지 확인해주세요.`,
        );
      }
      break;
    case "docx":
      try {
        text = await extractDocxText(file.buffer);
      } catch {
        throw new DocumentParseError(
          `${file.filename} 파일을 읽지 못했어요. DOCX 파일이 손상되지 않았는지 확인해주세요.`,
        );
      }
      break;
    case "hwp":
    case "hwpx":
      try {
        text = await extractHwpText(file.buffer, file.filename);
      } catch (err) {
        if (err instanceof DocumentParseError) throw err;
        throw new DocumentParseError(
          `${file.filename} 파일을 읽지 못했어요. HWP/HWPX 파일이 손상되지 않았는지 확인해주세요.`,
        );
      }
      break;
    default:
      throw new UnsupportedFileTypeError(
        `지원하지 않는 파일 형식이에요: ${file.filename}`,
      );
  }

  if (text.trim().length === 0) {
    throw new EmptyDocumentError(
      `${file.filename} 파일에서 텍스트를 찾지 못했어요. 파일이 비어있어요.`,
    );
  }

  return text;
}
