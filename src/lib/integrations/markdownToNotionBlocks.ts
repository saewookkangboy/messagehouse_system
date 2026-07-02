/** Notion API block objects (subset used for export). */
export type NotionBlock = {
  object: "block";
  type: string;
  [key: string]: unknown;
};

const MAX_TEXT = 2000;

function richText(content: string) {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  let rest = content;
  while (rest.length > 0) {
    chunks.push({ type: "text", text: { content: rest.slice(0, MAX_TEXT) } });
    rest = rest.slice(MAX_TEXT);
  }
  return chunks.length > 0 ? chunks : [{ type: "text", text: { content: "" } }];
}

function paragraph(text: string): NotionBlock {
  return { object: "block", type: "paragraph", paragraph: { rich_text: richText(text) } };
}

function heading(level: 1 | 2 | 3, text: string): NotionBlock {
  const key = `heading_${level}` as const;
  return { object: "block", type: key, [key]: { rich_text: richText(text) } };
}

function bullet(text: string): NotionBlock {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: richText(text) },
  };
}

function numbered(text: string): NotionBlock {
  return {
    object: "block",
    type: "numbered_list_item",
    numbered_list_item: { rich_text: richText(text) },
  };
}

/**
 * Export용 Markdown(고정 섹션 구조)을 Notion 블록 배열로 변환해요.
 */
export function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.split("\n");
  const blocks: NotionBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("# ")) {
      blocks.push(heading(1, line.slice(2).trim()));
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(heading(2, line.slice(3).trim()));
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(heading(3, line.slice(4).trim()));
      i += 1;
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      blocks.push(numbered(line.replace(/^\d+\.\s/, "").trim()));
      i += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      blocks.push(bullet(line.slice(2).trim()));
      i += 1;
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const paraLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("- ") &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(paragraph(paraLines.join("\n")));
  }

  return blocks.length > 0 ? blocks : [paragraph("")];
}

export function chunkNotionBlocks(blocks: NotionBlock[], size = 100): NotionBlock[][] {
  const chunks: NotionBlock[][] = [];
  for (let i = 0; i < blocks.length; i += size) {
    chunks.push(blocks.slice(i, i + size));
  }
  return chunks;
}
