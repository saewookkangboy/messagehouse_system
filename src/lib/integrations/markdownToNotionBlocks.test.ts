import { describe, expect, it } from "vitest";
import { markdownToNotionBlocks } from "./markdownToNotionBlocks";

describe("markdownToNotionBlocks", () => {
  it("maps headings and list items to Notion block types", () => {
    const md = `# Title

## Section
1. First pillar
- Bullet item

Body paragraph`;
    const blocks = markdownToNotionBlocks(md);
    expect(blocks[0].type).toBe("heading_1");
    expect(blocks[1].type).toBe("heading_2");
    expect(blocks[2].type).toBe("numbered_list_item");
    expect(blocks[3].type).toBe("bulleted_list_item");
    expect(blocks[4].type).toBe("paragraph");
  });
});
