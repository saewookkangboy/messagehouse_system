import type { ContextPack } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  deserializePillars,
  deserializeStringList,
} from "@/lib/contextPackSerialization";
import type { ExportablePack } from "@/lib/exportFormats";
import type { IntegrationProvider } from "@/generated/prisma/client";
import { getValidAccessToken } from "./connections";
import { exportToGoogleDrive } from "./googleDrive";
import { exportToNotion } from "./notion";

export class ExportPackError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ExportPackError";
    this.statusCode = statusCode;
  }
}

export function assertConfirmedForDestinationExport(pack: ContextPack): void {
  if (pack.status !== "confirmed") {
    throw new ExportPackError(
      "확정된 Context Pack만 Notion·Google Drive에 저장할 수 있어요. 검토 화면에서 확정해주세요.",
      400,
    );
  }
  if (!pack.roofMessage) {
    throw new ExportPackError("아직 메시지하우스가 생성되지 않았어요.", 400);
  }
}

export function packToExportable(pack: ContextPack): ExportablePack {
  return {
    issue: pack.issue,
    industry: pack.industry,
    version: pack.version,
    roofMessage: pack.roofMessage!,
    pillars: deserializePillars(pack.pillars),
    foundation: pack.foundation ?? "",
    objections: deserializeStringList(pack.objections),
    aieoSummary: pack.aieoSummary ?? "",
    riskFlags: deserializeStringList(pack.riskFlags),
    forbiddenTerms: pack.forbiddenTerms ?? "",
    officialTerms: pack.officialTerms ?? "",
  };
}

export async function exportPackToDestination(input: {
  packId: string;
  userId: string;
  provider: IntegrationProvider;
  format?: "markdown" | "json";
}) {
  const pack = await db.contextPack.findUnique({ where: { id: input.packId } });
  if (!pack) {
    throw new ExportPackError("Context Pack을 찾지 못했어요.", 404);
  }
  assertConfirmedForDestinationExport(pack);

  const format = input.format ?? "markdown";
  const { token, metadata } = await getValidAccessToken(input.userId, input.provider);
  const exportable = packToExportable(pack);

  const existing = await db.exportDestination.findUnique({
    where: {
      contextPackId_provider: {
        contextPackId: input.packId,
        provider: input.provider,
      },
    },
  });

  const destinationInput = {
    pack: exportable,
    format,
    metadata,
    existingExternalId: existing?.externalId,
  };

  const result =
    input.provider === "google_drive"
      ? await exportToGoogleDrive(token, destinationInput)
      : input.provider === "notion"
        ? await exportToNotion(token, destinationInput)
        : (() => {
            const _exhaustive: never = input.provider;
            return _exhaustive;
          })();

  await db.exportDestination.upsert({
    where: {
      contextPackId_provider: {
        contextPackId: input.packId,
        provider: input.provider,
      },
    },
    create: {
      contextPackId: input.packId,
      provider: input.provider,
      externalId: result.externalId,
      url: result.url,
      format,
      exportedById: input.userId,
    },
    update: {
      externalId: result.externalId,
      url: result.url,
      format,
      exportedById: input.userId,
    },
  });

  return result;
}
