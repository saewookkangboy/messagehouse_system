export const CHUNK_SIZE = 1_200;
export const CHUNK_OVERLAP = 200;

function splitLongParagraph(paragraph: string): string[] {
  const pieces: string[] = [];
  let start = 0;

  while (start < paragraph.length) {
    let end = Math.min(start + CHUNK_SIZE, paragraph.length);
    if (end < paragraph.length) {
      const window = paragraph.slice(start, end);
      const sentenceBreak = Math.max(
        window.lastIndexOf(".\n"),
        window.lastIndexOf(".\r"),
        window.lastIndexOf("다. "),
        window.lastIndexOf("요. "),
        window.lastIndexOf("니다. "),
        window.lastIndexOf("습니다. "),
        window.lastIndexOf("? "),
        window.lastIndexOf("! "),
      );
      if (sentenceBreak > CHUNK_SIZE * 0.5) {
        end = start + sentenceBreak + 1;
      }
    }

    const piece = paragraph.slice(start, end).trim();
    if (piece) pieces.push(piece);
    if (end >= paragraph.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return pieces;
}

/**
 * Splits long document text into overlapping chunks for embedding.
 * Paragraph boundaries are preferred; oversized paragraphs split on Korean sentence cues.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";

  function flush() {
    const piece = buffer.trim();
    if (piece) chunks.push(piece);
    buffer = "";
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length <= CHUNK_SIZE) {
      const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      if (candidate.length <= CHUNK_SIZE) {
        buffer = candidate;
      } else {
        flush();
        buffer = paragraph;
      }
      continue;
    }

    flush();
    chunks.push(...splitLongParagraph(paragraph));
  }

  flush();

  if (chunks.length > 1) {
    const merged: string[] = [];
    for (const chunk of chunks) {
      const prev = merged[merged.length - 1];
      if (prev && prev.length < CHUNK_SIZE * 0.35 && prev.length + 2 + chunk.length <= CHUNK_SIZE) {
        merged[merged.length - 1] = `${prev}\n\n${chunk}`;
      } else {
        merged.push(chunk);
      }
    }
    return merged;
  }

  return chunks;
}
