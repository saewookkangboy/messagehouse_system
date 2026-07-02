import type { IntegrationProvider } from "@/generated/prisma/client";
import type { ExportablePack } from "@/lib/exportFormats";

export type { IntegrationProvider };

export type IntegrationMetadata = {
  workspaceName?: string;
  defaultFolderId?: string;
  notionDatabaseId?: string;
  notionParentPageId?: string;
  titlePropertyName?: string;
};

export type ExportDestinationResult = {
  externalId: string;
  url: string;
  updated: boolean;
};

export type DestinationExportInput = {
  pack: ExportablePack;
  format: "markdown" | "json";
  metadata: IntegrationMetadata;
  existingExternalId?: string;
};

export interface DestinationProvider {
  readonly provider: IntegrationProvider;
  exportPack(
    accessToken: string,
    input: DestinationExportInput,
  ): Promise<ExportDestinationResult>;
}

export function parseIntegrationMetadata(raw: string | null | undefined): IntegrationMetadata {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as IntegrationMetadata;
  } catch {
    return {};
  }
}

export function serializeIntegrationMetadata(meta: IntegrationMetadata): string {
  return JSON.stringify(meta);
}

export function safeExportFilename(issue: string, version: string, ext: string): string {
  const slug =
    issue
      .replace(/[^\w\uAC00-\uD7A3\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 50) || "context-pack";
  return `messagehouse-${slug}-v${version}.${ext}`;
}
