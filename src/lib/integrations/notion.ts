import type { DestinationExportInput, ExportDestinationResult } from "./schema";
import { toExportJson, toExportMarkdown } from "@/lib/exportFormats";
import { chunkNotionBlocks, markdownToNotionBlocks } from "./markdownToNotionBlocks";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function notionFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
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

function exportBody(input: DestinationExportInput): string {
  return input.format === "json"
    ? toExportJson(input.pack)
    : toExportMarkdown(input.pack);
}

async function clearPageBlocks(accessToken: string, pageId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const qs = cursor ? `?start_cursor=${cursor}` : "";
    const res = await notionFetch(accessToken, `/blocks/${pageId}/children${qs}`);
    if (!res.ok) break;
    const data = (await res.json()) as {
      results: { id: string }[];
      has_more: boolean;
      next_cursor: string | null;
    };
    for (const block of data.results) {
      await notionFetch(accessToken, `/blocks/${block.id}`, { method: "DELETE" });
    }
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
}

async function appendBlocks(
  accessToken: string,
  blockId: string,
  markdown: string,
): Promise<void> {
  const blocks = markdownToNotionBlocks(markdown);
  for (const chunk of chunkNotionBlocks(blocks)) {
    const res = await notionFetch(accessToken, `/blocks/${blockId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: chunk }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion 블록 추가 실패: ${err.slice(0, 200)}`);
    }
  }
}

function buildDatabaseProperties(
  input: DestinationExportInput,
  titleProperty: string,
): Record<string, unknown> {
  const title = `${input.pack.issue} — v${input.pack.version}`;
  return {
    [titleProperty]: {
      title: [{ type: "text", text: { content: title.slice(0, 2000) } }],
    },
  };
}

export async function exportToNotion(
  accessToken: string,
  input: DestinationExportInput,
): Promise<ExportDestinationResult> {
  const markdown = exportBody(input);
  const databaseId = input.metadata.notionDatabaseId?.trim();
  const parentPageId = input.metadata.notionParentPageId?.trim();
  const titleProperty = input.metadata.titlePropertyName?.trim() || "Name";

  if (input.existingExternalId) {
    await clearPageBlocks(accessToken, input.existingExternalId);
    await appendBlocks(accessToken, input.existingExternalId, markdown);
    return {
      externalId: input.existingExternalId,
      url: `https://notion.so/${input.existingExternalId.replace(/-/g, "")}`,
      updated: true,
    };
  }

  if (!databaseId && !parentPageId) {
    throw new Error(
      "Notion 저장 위치가 설정되지 않았어요. 연동 설정에서 데이터베이스 ID 또는 상위 페이지 ID를 입력해주세요.",
    );
  }

  const children = chunkNotionBlocks(markdownToNotionBlocks(markdown))[0] ?? [];

  const parent = databaseId
    ? { database_id: databaseId }
    : { page_id: parentPageId! };

  const payload: Record<string, unknown> = {
    parent,
    children,
  };

  if (databaseId) {
    payload.properties = buildDatabaseProperties(input, titleProperty);
  } else {
    payload.properties = {
      title: {
        title: [
          {
            type: "text",
            text: {
              content: `${input.pack.issue} — v${input.pack.version}`.slice(0, 2000),
            },
          },
        ],
      },
    };
  }

  const res = await notionFetch(accessToken, "/pages", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion 페이지 생성 실패: ${err.slice(0, 200)}`);
  }

  const page = (await res.json()) as { id: string; url?: string };
  const remaining = markdownToNotionBlocks(markdown).slice(children.length);
  for (const chunk of chunkNotionBlocks(remaining)) {
    await notionFetch(accessToken, `/blocks/${page.id}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: chunk }),
    });
  }

  return {
    externalId: page.id,
    url: page.url ?? `https://notion.so/${page.id.replace(/-/g, "")}`,
    updated: false,
  };
}

export function notionOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) {
    throw new Error("NOTION_CLIENT_ID가 설정되지 않았어요.");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    owner: "user",
    redirect_uri: redirectUri,
    state,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params}`;
}

export async function exchangeNotionCode(
  code: string,
  redirectUri: string,
): Promise<{
  accessToken: string;
  workspaceName: string;
  workspaceId: string;
}> {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NOTION_CLIENT_ID / NOTION_CLIENT_SECRET가 설정되지 않았어요.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error("Notion OAuth 인증에 실패했어요.");
  }

  const data = (await res.json()) as {
    access_token: string;
    workspace_name: string;
    workspace_id: string;
  };

  return {
    accessToken: data.access_token,
    workspaceName: data.workspace_name,
    workspaceId: data.workspace_id,
  };
}
