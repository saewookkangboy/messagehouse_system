import { db } from "@/lib/db";
import type { IntegrationProvider } from "@/generated/prisma/client";
import { decryptToken, encryptToken } from "./crypto";
import {
  parseIntegrationMetadata,
  serializeIntegrationMetadata,
  type IntegrationMetadata,
} from "./schema";
import { refreshGoogleAccessToken } from "./googleDrive";

export type ConnectionPublic = {
  provider: IntegrationProvider;
  connected: boolean;
  workspaceName?: string;
  metadata: IntegrationMetadata;
  connectedAt?: string;
};

export async function getConnection(
  userId: string,
  provider: IntegrationProvider,
) {
  return db.integrationConnection.findUnique({
    where: { userId_provider: { userId, provider } },
  });
}

export async function listConnections(userId: string): Promise<ConnectionPublic[]> {
  const rows = await db.integrationConnection.findMany({
    where: { userId },
    orderBy: { provider: "asc" },
  });

  const providers: IntegrationProvider[] = ["google_drive", "notion"];
  return providers.map((provider) => {
    const row = rows.find((r) => r.provider === provider);
    if (!row) {
      return { provider, connected: false, metadata: {} };
    }
    const metadata = parseIntegrationMetadata(row.metadata);
    return {
      provider,
      connected: true,
      workspaceName: metadata.workspaceName,
      metadata,
      connectedAt: row.createdAt.toISOString(),
    };
  });
}

export async function upsertConnection(input: {
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: IntegrationMetadata;
}) {
  const existing = await getConnection(input.userId, input.provider);
  const metadata = {
    ...(existing ? parseIntegrationMetadata(existing.metadata) : {}),
    ...(input.metadata ?? {}),
  };

  return db.integrationConnection.upsert({
    where: { userId_provider: { userId: input.userId, provider: input.provider } },
    create: {
      userId: input.userId,
      provider: input.provider,
      accessToken: encryptToken(input.accessToken),
      refreshToken: input.refreshToken ? encryptToken(input.refreshToken) : null,
      expiresAt: input.expiresAt ?? null,
      metadata: serializeIntegrationMetadata(metadata),
    },
    update: {
      accessToken: encryptToken(input.accessToken),
      refreshToken: input.refreshToken
        ? encryptToken(input.refreshToken)
        : existing?.refreshToken ?? null,
      expiresAt: input.expiresAt ?? null,
      metadata: serializeIntegrationMetadata(metadata),
    },
  });
}

export async function updateConnectionMetadata(
  userId: string,
  provider: IntegrationProvider,
  patch: IntegrationMetadata,
) {
  const existing = await getConnection(userId, provider);
  if (!existing) {
    throw new Error("연동이 되어 있지 않아요.");
  }
  const metadata = { ...parseIntegrationMetadata(existing.metadata), ...patch };
  return db.integrationConnection.update({
    where: { id: existing.id },
    data: { metadata: serializeIntegrationMetadata(metadata) },
  });
}

export async function deleteConnection(userId: string, provider: IntegrationProvider) {
  await db.integrationConnection.deleteMany({ where: { userId, provider } });
}

export async function getValidAccessToken(
  userId: string,
  provider: IntegrationProvider,
): Promise<{ token: string; metadata: IntegrationMetadata }> {
  const conn = await getConnection(userId, provider);
  if (!conn) {
    throw new Error("외부 서비스 연동이 필요해요. 설정에서 먼저 연결해주세요.");
  }

  let accessToken = decryptToken(conn.accessToken);
  const metadata = parseIntegrationMetadata(conn.metadata);

  const needsRefresh =
    provider === "google_drive" &&
    conn.expiresAt &&
    conn.expiresAt.getTime() < Date.now() + 60_000;

  if (needsRefresh && conn.refreshToken) {
    const refreshed = await refreshGoogleAccessToken(decryptToken(conn.refreshToken));
    accessToken = refreshed.accessToken;
    await db.integrationConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: encryptToken(refreshed.accessToken),
        expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      },
    });
  }

  return { token: accessToken, metadata };
}
