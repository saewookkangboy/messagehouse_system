/**
 * Notion에서 문서를 가져와요(import). 기존 OAuth 토큰은 사용자가 연동 시 공유한
 * 페이지·데이터베이스를 읽을 수 있어요(search/blocks). 이 환경엔 Notion 자격증명이
 * 없어 실 API는 미검증이에요 — 순수 변환 로직만 유닛 테스트로 커버해요.
 */
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export type ImportableDocument = {
  externalId: string;
  title: string;
};

type NotionRichText = { plain_text?: string };
type NotionBlock = {
  type: string;
  has_children?: boolean;
  id: string;
} & Record<string, unknown>;

const TEXTUAL_TYPES = new Set([
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bulleted_list_item",
  "numbered_list_item",
  "to_do",
  "toggle",
  "quote",
  "callout",
  "code",
]);

const PREFIX: Record<string, string> = {
  heading_1: "# ",
  heading_2: "## ",
  heading_3: "### ",
  bulleted_list_item: "- ",
  numbered_list_item: "- ",
  to_do: "- ",
  quote: "> ",
};

function richTextToString(rich: NotionRichText[] | undefined): string {
  if (!Array.isArray(rich)) return "";
  return rich.map((r) => r.plain_text ?? "").join("");
}

/** Notion 블록 배열을 평문으로 변환해요. (순수 함수) */
export function notionBlocksToText(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (!TEXTUAL_TYPES.has(block.type)) continue;
    const payload = block[block.type] as { rich_text?: NotionRichText[] } | undefined;
    const text = richTextToString(payload?.rich_text);
    if (text.trim().length === 0) continue;
    lines.push((PREFIX[block.type] ?? "") + text);
  }
  return lines.join("\n");
}

/** 검색 결과(페이지 객체)에서 제목을 뽑아요. (순수 함수) */
export function extractNotionPageTitle(page: {
  properties?: Record<string, { type?: string; title?: NotionRichText[] }>;
}): string {
  const props = page.properties ?? {};
  for (const value of Object.values(props)) {
    if (value?.type === "title" && Array.isArray(value.title)) {
      const t = richTextToString(value.title).trim();
      if (t) return t;
    }
  }
  return "제목 없는 Notion 페이지";
}

async function notionFetch(accessToken: string, path: string, init?: RequestInit) {
  return fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

/** 연동 시 공유된 페이지 목록을 반환해요. */
export async function listNotionDocuments(
  accessToken: string,
): Promise<ImportableDocument[]> {
  const res = await notionFetch(accessToken, "/search", {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "object", value: "page" },
      page_size: 50,
    }),
  });
  if (!res.ok) {
    throw new Error(`Notion 문서 목록을 불러오지 못했어요 (${res.status}).`);
  }
  const data = (await res.json()) as {
    results: Array<{ id: string; properties?: Record<string, never> }>;
  };
  return data.results.map((page) => ({
    externalId: page.id,
    title: extractNotionPageTitle(page),
  }));
}

/** 페이지 본문을 평문으로 가져와요 (자식 블록 페이지네이션 포함). */
export async function fetchNotionPageText(
  accessToken: string,
  pageId: string,
): Promise<string> {
  const all: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const qs = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
    const res = await notionFetch(accessToken, `/blocks/${pageId}/children${qs}`);
    if (!res.ok) {
      throw new Error(`Notion 페이지 본문을 불러오지 못했어요 (${res.status}).`);
    }
    const data = (await res.json()) as {
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    };
    all.push(...data.results);
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return notionBlocksToText(all);
}
