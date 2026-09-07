-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('CLICKUP', 'KOLAY_IK', 'CLOCKIFY');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONFIGURED', 'CONNECTED', 'ERROR', 'SYNCING', 'DISABLED');

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN "source" TEXT DEFAULT 'MANUAL';
ALTER TABLE "TimeEntry" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE INDEX "TimeEntry_companyId_source_externalId_idx" ON "TimeEntry"("companyId", "source", "externalId");

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "encryptedCredentials" TEXT,
    "config" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalEntityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "internalEntityType" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLeave" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "notes" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_companyId_provider_key" ON "Integration"("companyId", "provider");

-- CreateIndex
CREATE INDEX "Integration_companyId_idx" ON "Integration"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationMapping_companyId_provider_externalEntityType_externalId_key" ON "IntegrationMapping"("companyId", "provider", "externalEntityType", "externalId");

-- CreateIndex
CREATE INDEX "IntegrationMapping_companyId_provider_internalEntityType_internalId_idx" ON "IntegrationMapping"("companyId", "provider", "internalEntityType", "internalId");

-- CreateIndex
CREATE INDEX "EmployeeLeave_companyId_employeeId_idx" ON "EmployeeLeave"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeLeave_companyId_startDate_endDate_idx" ON "EmployeeLeave"("companyId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "EmployeeLeave_companyId_externalId_idx" ON "EmployeeLeave"("companyId", "externalId");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationMapping" ADD CONSTRAINT "IntegrationMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeave" ADD CONSTRAINT "EmployeeLeave_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeave" ADD CONSTRAINT "EmployeeLeave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
