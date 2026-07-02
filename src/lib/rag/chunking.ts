export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 150;

/**
 * Splits long document text into overlapping chunks for embedding.
 * Paragraph boundaries are preferred; oversized paragraphs are hard-split.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
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
    let start = 0;
    while (start < paragraph.length) {
      const end = Math.min(start + CHUNK_SIZE, paragraph.length);
      chunks.push(paragraph.slice(start, end));
      if (end >= paragraph.length) break;
      start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }
  }

  flush();
  return chunks;
}
