import type { ContextPack, SourceFile } from "@/generated/prisma/client";
import type { ResearchResult } from "@/lib/research/schema";
import type { PipelineStatus } from "@/lib/pipeline/schema";

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `요청이 실패했어요 (${res.status})`);
  }
  return body as T;
}

export function listContextPacks() {
  return fetch("/api/context-packs").then((r) =>
    handle<{ contextPacks: (ContextPack & { _count: { files: number } })[] }>(r),
  );
}

export function createContextPack(input?: { issue?: string; industry?: string }) {
  return fetch("/api/context-packs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  }).then((r) => handle<{ contextPack: ContextPack }>(r));
}

export function getContextPack(id: string) {
  return fetch(`/api/context-packs/${id}`).then((r) =>
    handle<{ contextPack: ContextPack & { files: SourceFile[] } }>(r),
  );
}

export function patchContextPack(id: string, data: Record<string, unknown>) {
  return fetch(`/api/context-packs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => handle<{ contextPack: ContextPack }>(r));
}

export function uploadFiles(id: string, files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  return fetch(`/api/context-packs/${id}/files`, {
    method: "POST",
    body: formData,
  }).then((r) =>
    handle<{ files: SourceFile[]; errors: { filename: string; message: string }[] }>(r),
  );
}

export function deleteFile(id: string, fileId: string) {
  return fetch(`/api/context-packs/${id}/files/${fileId}`, {
    method: "DELETE",
  }).then((r) => handle<{ ok: true }>(r));
}

export function analyzeContextPack(id: string) {
  return fetch(`/api/context-packs/${id}/analyze`, { method: "POST" }).then((r) =>
    handle<{ files: SourceFile[]; updatedCount: number; errors: { filename: string; message: string }[] }>(
      r,
    ),
  );
}

export function researchContextPack(id: string) {
  return fetch(`/api/context-packs/${id}/research`, { method: "POST" }).then((r) =>
    handle<{ contextPack: ContextPack; research: ResearchResult }>(r),
  );
}

export function generateContextPack(id: string) {
  return fetch(`/api/context-packs/${id}/generate`, { method: "POST" }).then((r) =>
    handle<{ contextPack: ContextPack }>(r),
  );
}

export function getPipelineStatus(id: string) {
  return fetch(`/api/context-packs/${id}/pipeline`).then((r) =>
    handle<{ contextPack: ContextPack & { files: SourceFile[] }; pipeline: PipelineStatus }>(r),
  );
}

export function runPipeline(
  id: string,
  options?: { target?: "analyzed" | "researched" | "generated"; force?: boolean },
) {
  return fetch(`/api/context-packs/${id}/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? { target: "researched" }),
  }).then((r) =>
    handle<{
      contextPack: ContextPack & { files: SourceFile[] };
      pipeline: PipelineStatus;
      stepsRun: string[];
      analyze?: { files: SourceFile[]; updatedCount: number; errors: { filename: string; message: string }[] };
      research?: { contextPack: ContextPack; research: ResearchResult };
      generate?: { contextPack: ContextPack };
    }>(r),
  );
}

export function getExport(id: string, format: "json" | "markdown" | "claude") {
  return fetch(`/api/context-packs/${id}/export?format=${format}`).then((r) =>
    handle<{ format: string; text: string }>(r),
  );
}

export type IntegrationMetadata = {
  defaultFolderId?: string;
  notionDatabaseId?: string;
  notionParentPageId?: string;
  titlePropertyName?: string;
};

export type IntegrationConnectionRow = {
  provider: "google_drive" | "notion";
  connected: boolean;
  workspaceName?: string;
  metadata: IntegrationMetadata;
  connectedAt?: string;
};

export function getIntegrations() {
  return fetch("/api/integrations").then((r) =>
    handle<{
      authRequired: boolean;
      configured: { google: boolean; notion: boolean };
      connections: IntegrationConnectionRow[];
    }>(r),
  );
}

export function updateIntegrationSettings(
  provider: "google" | "notion",
  metadata: IntegrationMetadata,
) {
  return fetch(`/api/integrations/${provider}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  }).then((r) => handle<{ ok: true }>(r));
}

export function disconnectIntegration(provider: "google" | "notion") {
  return fetch(`/api/integrations/${provider}`, { method: "DELETE" }).then((r) =>
    handle<{ ok: true }>(r),
  );
}

export type ExportDestinationRow = {
  provider: "google_drive" | "notion";
  url: string;
  format: string;
  updatedAt: string;
};

export function getExportDestinations(packId: string) {
  return fetch(`/api/context-packs/${packId}/export/destinations`).then((r) =>
    handle<{ destinations: ExportDestinationRow[] }>(r),
  );
}

export function exportToDestination(
  packId: string,
  input: { provider: "google_drive" | "notion" | "google"; format?: "markdown" | "json" },
) {
  return fetch(`/api/context-packs/${packId}/export/destinations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) =>
    handle<{
      provider: string;
      url: string;
      externalId: string;
      updated: boolean;
    }>(r),
  );
}

export type AuthMe =
  | { authDisabled: true; authenticated: false }
  | { authenticated: false }
  | {
      authenticated: true;
      user: { id: string; email: string; name: string };
      team: { id: string; name: string };
      role: string;
    };

export function getMe() {
  return fetch("/api/auth/me").then((r) => handle<AuthMe>(r));
}

export function login(email: string, password: string) {
  return fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => handle<{ user: { id: string; email: string; name: string } }>(r));
}

export function register(input: {
  email: string;
  name: string;
  password: string;
  teamName?: string;
}) {
  return fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) =>
    handle<{ user: { id: string; email: string; name: string }; team: { id: string; name: string } }>(
      r,
    ),
  );
}

export function logout() {
  return fetch("/api/auth/logout", { method: "POST" }).then((r) => handle<{ ok: true }>(r));
}

export type OrgDocumentRow = {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  uploadedBy: { name: string; email: string } | null;
};

export function listOrgDocuments() {
  return fetch("/api/org-documents").then((r) => handle<{ documents: OrgDocumentRow[] }>(r));
}

export function uploadOrgDocument(input: {
  title: string;
  description?: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("title", input.title);
  if (input.description) formData.append("description", input.description);
  formData.append("file", input.file);
  return fetch("/api/org-documents", { method: "POST", body: formData }).then((r) =>
    handle<{ document: OrgDocumentRow }>(r),
  );
}

export function deleteOrgDocument(id: string) {
  return fetch(`/api/org-documents/${id}`, { method: "DELETE" }).then((r) =>
    handle<{ ok: true }>(r),
  );
}

export type TeamMemberRow = {
  userId: string;
  role: string;
  user: { id: string; email: string; name: string };
};

export function listTeamMembers() {
  return fetch("/api/team/members").then((r) =>
    handle<{ team: { id: string; name: string }; members: TeamMemberRow[] }>(r),
  );
}

export function updateTeamMemberRole(userId: string, role: "admin" | "editor" | "viewer") {
  return fetch(`/api/team/members/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  }).then((r) => handle<{ member: { role: string } }>(r));
}

export function removeTeamMember(userId: string) {
  return fetch(`/api/team/members/${userId}`, { method: "DELETE" }).then((r) =>
    handle<{ ok: true }>(r),
  );
}

export type TeamInviteRow = {
  id: string;
  email: string;
  role: string;
  invitePath: string;
  expiresAt: string;
  createdAt: string;
};

export function listTeamInvites() {
  return fetch("/api/team/invites").then((r) =>
    handle<{ invites: TeamInviteRow[] }>(r),
  );
}

export function createTeamInvite(input: {
  email: string;
  role: "admin" | "editor" | "viewer";
}) {
  return fetch("/api/team/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) =>
    handle<{ invite: { id: string; token: string; invitePath: string; expiresAt: string } }>(
      r,
    ),
  );
}

export function revokeTeamInvite(id: string) {
  return fetch(`/api/team/invites?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).then((r) => handle<{ ok: true }>(r));
}

export function getInvitePreview(token: string) {
  return fetch(`/api/invites/${token}`).then((r) =>
    handle<{
      invite: { email: string; role: string; teamName: string; expiresAt: string };
    }>(r),
  );
}

export function acceptInvite(
  token: string,
  registration?: { name: string; password: string },
) {
  return fetch(`/api/invites/${token}`, {
    method: "POST",
    headers: registration ? { "Content-Type": "application/json" } : undefined,
    body: registration ? JSON.stringify(registration) : undefined,
  }).then((r) =>
    handle<{
      accepted: true;
      user?: { id: string; email: string; name: string };
      team: { id: string; name: string };
      role?: string;
    }>(r),
  );
}

export function streamPipelineUrl(
  id: string,
  options?: { target?: "analyzed" | "researched" | "generated" },
) {
  const params = new URLSearchParams({ target: options?.target ?? "researched" });
  return `/api/context-packs/${id}/pipeline/stream?${params}`;
}

export type { ContextPack, SourceFile };
