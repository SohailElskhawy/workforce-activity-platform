-- CreateTable
CREATE TABLE "CompanyTrackingSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "idleThresholdSeconds" INTEGER NOT NULL DEFAULT 300,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyTrackingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcludedApplication" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcludedApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTrackingSettings_companyId_key" ON "CompanyTrackingSettings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ExcludedApplication_companyId_processName_key" ON "ExcludedApplication"("companyId", "processName");

-- CreateIndex
CREATE INDEX "ExcludedApplication_companyId_idx" ON "ExcludedApplication"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyTrackingSettings" ADD CONSTRAINT "CompanyTrackingSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcludedApplication" ADD CONSTRAINT "ExcludedApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
