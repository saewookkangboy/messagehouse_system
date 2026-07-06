/**
 * 업로드 문서에서 추출한 텍스트를 분석·임베딩에 적합한 평문으로 정리해요.
 * PDF 줄바꿈 깨짐, kordoc 마크다운 잔여물, 유니코드 정규화를 한곳에서 처리합니다.
 */

const PDF_PAGE_FOOTER_RE =
  /\n?--\s*\d+\s+of\s+\d+\s*--\n?/gi;

const HTML_TAG_RE = /<[^>]+>/g;

/** kordoc PDF 표 출력에 남는 HTML 태그 제거 */
function stripHtmlTags(text: string): string {
  return text
    .replace(HTML_TAG_RE, " ")
    .replace(/<\/?[^>\n]+$/gm, " ");
}

/** PDF 다단 레이아웃에서 섞인 ` | ` 구분자를 문단 경계로 변환 */
function splitMultiColumnPipes(text: string): string {
  return text.replace(/\s\|\s/g, "\n\n");
}

/** 한글 조사/어미 앞 불필요 공백 제거 (예: "한화생명 은" → "한화생명은") */
function fixKoreanParticleSpacing(text: string): string {
  return text.replace(
    /([가-힣A-Za-z0-9])\s+(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|부터|까지|에게|께|한테|처럼|보다|조차|마저|밖에|뿐)(?=[\s,.!?]|$)/g,
    "$1$2",
  );
}

const MARKDOWN_TABLE_SEP_RE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function stripMarkdownSyntax(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

function flattenMarkdownTableRow(line: string): string {
  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  if (cells.length === 0) return "";
  if (cells.length === 1) return cells[0]!;
  return cells.join(" · ");
}

function flattenMarkdownTables(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let tableBuffer: string[] = [];

  function flushTable() {
    if (tableBuffer.length === 0) return;
    for (const row of tableBuffer) {
      const flat = flattenMarkdownTableRow(row);
      if (flat) out.push(flat);
    }
    tableBuffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const isTableLine = trimmed.includes("|") && trimmed.length > 0;
    const isSeparator = MARKDOWN_TABLE_SEP_RE.test(trimmed);

    if (isTableLine && !isSeparator) {
      tableBuffer.push(trimmed);
      continue;
    }
    if (isSeparator) continue;

    flushTable();
    out.push(line);
  }
  flushTable();
  return out.join("\n");
}

/**
 * PDF/DOCX에서 흔한 단일 줄바꿈을 공백으로 합쳐 문장이 끊기지 않게 해요.
 * 문단 경계(빈 줄)와 목록·표 행은 유지합니다.
 */
export function fixBrokenLineBreaks(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      const merged: string[] = [];
      let buffer = "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const isStructural =
          /^#{1,6}\s/.test(line) ||
          /^[-*+]\s/.test(line) ||
          /^\d+\.\s/.test(line) ||
          (line.includes("|") && line.split("|").filter(Boolean).length >= 2);

        if (!buffer) {
          buffer = line;
          if (isStructural) {
            merged.push(buffer);
            buffer = "";
          }
          continue;
        }

        const prevEndsSentence = /[.!?…。！？:：)\]】」』%]$/.test(buffer);
        const shouldJoin =
          !isStructural &&
          !prevEndsSentence &&
          !/^[-*#|]/.test(line) &&
          !/^[-*#|]/.test(buffer);

        if (shouldJoin) {
          buffer = `${buffer} ${line}`;
        } else {
          merged.push(buffer);
          buffer = line;
          if (isStructural) {
            merged.push(buffer);
            buffer = "";
          }
        }
      }

      if (buffer) merged.push(buffer);
      return merged.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

/** kordoc 마크다운·PDF 잔여물을 제거하고 한국어 텍스트를 NFC로 정규화해요. */
export function normalizeExtractedText(raw: string): string {
  let text = raw.normalize("NFC");
  text = text.replace(/\r\n/g, "\n").replace(PDF_PAGE_FOOTER_RE, "\n");
  text = stripHtmlTags(text);
  text = flattenMarkdownTables(text);
  text = splitMultiColumnPipes(text);

  const lines = text.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (trimmed === "---" || trimmed === "***") return "";
    return stripMarkdownSyntax(trimmed);
  });

  text = lines.join("\n");
  text = fixBrokenLineBreaks(text);
  text = fixKoreanParticleSpacing(text);
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
