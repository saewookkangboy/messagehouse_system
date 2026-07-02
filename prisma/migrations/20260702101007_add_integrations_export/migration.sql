-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExportDestination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contextPackId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'markdown',
    "exportedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExportDestination_contextPackId_fkey" FOREIGN KEY ("contextPackId") REFERENCES "ContextPack" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExportDestination_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IntegrationConnection_userId_idx" ON "IntegrationConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_userId_provider_key" ON "IntegrationConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "ExportDestination_contextPackId_idx" ON "ExportDestination"("contextPackId");

-- CreateIndex
CREATE UNIQUE INDEX "ExportDestination_contextPackId_provider_key" ON "ExportDestination"("contextPackId", "provider");
