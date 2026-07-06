import { describe, expect, it } from "vitest";
import { extractNotionPageTitle, notionBlocksToText } from "./notionImport";

describe("notionBlocksToText", () => {
  it("문단·제목·리스트를 평문으로 변환해요", () => {
    const blocks = [
      { id: "1", type: "heading_1", heading_1: { rich_text: [{ plain_text: "제목" }] } },
      { id: "2", type: "paragraph", paragraph: { rich_text: [{ plain_text: "본문 문단" }] } },
      {
        id: "3",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ plain_text: "항목 1" }] },
      },
    ];
    const text = notionBlocksToText(blocks);
    expect(text).toBe("# 제목\n본문 문단\n- 항목 1");
  });

  it("여러 rich_text 조각을 이어붙여요", () => {
    const blocks = [
      {
        id: "1",
        type: "paragraph",
        paragraph: { rich_text: [{ plain_text: "가입 시간 " }, { plain_text: "10분" }] },
      },
    ];
    expect(notionBlocksToText(blocks)).toBe("가입 시간 10분");
  });

  it("텍스트 없는 블록·미지원 타입은 건너뛰어요", () => {
    const blocks = [
      { id: "1", type: "divider", divider: {} },
      { id: "2", type: "image", image: {} },
      { id: "3", type: "paragraph", paragraph: { rich_text: [] } },
      { id: "4", type: "paragraph", paragraph: { rich_text: [{ plain_text: "유효" }] } },
    ];
    expect(notionBlocksToText(blocks)).toBe("유효");
  });

  it("빈 배열이면 빈 문자열", () => {
    expect(notionBlocksToText([])).toBe("");
  });
});

describe("extractNotionPageTitle", () => {
  it("title 타입 속성에서 제목을 뽑아요", () => {
    const page = {
      properties: {
        Name: { type: "title", title: [{ plain_text: "펫케어 3.0 기획안" }] },
      },
    };
    expect(extractNotionPageTitle(page)).toBe("펫케어 3.0 기획안");
  });

  it("제목 속성이 없으면 폴백 문구", () => {
    expect(extractNotionPageTitle({ properties: {} })).toBe("제목 없는 Notion 페이지");
    expect(extractNotionPageTitle({})).toBe("제목 없는 Notion 페이지");
  });
});
