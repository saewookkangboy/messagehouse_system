/*
  Warnings:

  - Added the required column `contextPackId` to the `DocumentChunk` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "extractedText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrgDocument_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrgDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgDocumentChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgDocumentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgDocumentChunk_orgDocumentId_fkey" FOREIGN KEY ("orgDocumentId") REFERENCES "OrgDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContextPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issue" TEXT NOT NULL DEFAULT '제목 없는 이슈',
    "industry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" TEXT NOT NULL DEFAULT '0.1',
    "teamId" TEXT,
    "createdById" TEXT,
    "roofMessage" TEXT,
    "pillars" TEXT,
    "foundation" TEXT,
    "objections" TEXT,
    "aieoSummary" TEXT,
    "riskFlags" TEXT,
    "forbiddenTerms" TEXT,
    "officialTerms" TEXT,
    "researchResult" TEXT,
    "researchedAt" DATETIME,
    "researchStatus" TEXT NOT NULL DEFAULT 'pending',
    "analyzedAt" DATETIME,
    "generatedAt" DATETIME,
    "confirmedAt" DATETIME,
    "pipelineRunningStep" TEXT,
    "pipelineError" TEXT,
    "pipelineErrorStep" TEXT,
    "gateMessageReviewed" BOOLEAN NOT NULL DEFAULT false,
    "gateNoConfidential" BOOLEAN NOT NULL DEFAULT false,
    "gateNumbersVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContextPack_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContextPack_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ContextPack" ("aieoSummary", "createdAt", "forbiddenTerms", "foundation", "gateMessageReviewed", "gateNoConfidential", "gateNumbersVerified", "id", "industry", "issue", "objections", "officialTerms", "pillars", "researchResult", "researchedAt", "researchStatus", "riskFlags", "roofMessage", "status", "updatedAt", "version") SELECT "aieoSummary", "createdAt", "forbiddenTerms", "foundation", "gateMessageReviewed", "gateNoConfidential", "gateNumbersVerified", "id", "industry", "issue", "objections", "officialTerms", "pillars", "researchResult", "researchedAt", CASE WHEN "researchResult" IS NOT NULL THEN 'completed' ELSE 'pending' END, "riskFlags", "roofMessage", "status", "updatedAt", "version" FROM "ContextPack";
DROP TABLE "ContextPack";
ALTER TABLE "new_ContextPack" RENAME TO "ContextPack";
CREATE INDEX "ContextPack_teamId_idx" ON "ContextPack"("teamId");
CREATE INDEX "ContextPack_updatedAt_idx" ON "ContextPack"("updatedAt");
CREATE INDEX "ContextPack_status_updatedAt_idx" ON "ContextPack"("status", "updatedAt");
CREATE TABLE "new_DocumentChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceFileId" TEXT NOT NULL,
    "contextPackId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentChunk" ("chunkIndex", "contextPackId", "createdAt", "embedding", "id", "model", "sourceFileId", "text") SELECT "DocumentChunk"."chunkIndex", "SourceFile"."contextPackId", "DocumentChunk"."createdAt", "DocumentChunk"."embedding", "DocumentChunk"."id", "DocumentChunk"."model", "DocumentChunk"."sourceFileId", "DocumentChunk"."text" FROM "DocumentChunk" INNER JOIN "SourceFile" ON "SourceFile"."id" = "DocumentChunk"."sourceFileId";
DROP TABLE "DocumentChunk";
ALTER TABLE "new_DocumentChunk" RENAME TO "DocumentChunk";
CREATE INDEX "DocumentChunk_sourceFileId_idx" ON "DocumentChunk"("sourceFileId");
CREATE INDEX "DocumentChunk_contextPackId_idx" ON "DocumentChunk"("contextPackId");
CREATE UNIQUE INDEX "DocumentChunk_sourceFileId_chunkIndex_key" ON "DocumentChunk"("sourceFileId", "chunkIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "OrgDocument_teamId_idx" ON "OrgDocument"("teamId");

-- CreateIndex
CREATE INDEX "OrgDocumentChunk_orgDocumentId_idx" ON "OrgDocumentChunk"("orgDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgDocumentChunk_orgDocumentId_chunkIndex_key" ON "OrgDocumentChunk"("orgDocumentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "SourceFile_contextPackId_idx" ON "SourceFile"("contextPackId");
