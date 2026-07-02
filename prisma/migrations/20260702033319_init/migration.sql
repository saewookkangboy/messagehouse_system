-- CreateTable
CREATE TABLE "ContextPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issue" TEXT NOT NULL DEFAULT '제목 없는 이슈',
    "industry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" TEXT NOT NULL DEFAULT '0.1',
    "roofMessage" TEXT,
    "pillars" TEXT,
    "foundation" TEXT,
    "objections" TEXT,
    "aieoSummary" TEXT,
    "riskFlags" TEXT,
    "forbiddenTerms" TEXT,
    "officialTerms" TEXT,
    "gateMessageReviewed" BOOLEAN NOT NULL DEFAULT false,
    "gateNoConfidential" BOOLEAN NOT NULL DEFAULT false,
    "gateNumbersVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contextPackId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "extractedText" TEXT NOT NULL,
    "docType" TEXT,
    "topic" TEXT,
    "claim" TEXT,
    "numbers" TEXT,
    "terms" TEXT,
    "audience" TEXT,
    "risk" TEXT,
    "analyzedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceFile_contextPackId_fkey" FOREIGN KEY ("contextPackId") REFERENCES "ContextPack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
