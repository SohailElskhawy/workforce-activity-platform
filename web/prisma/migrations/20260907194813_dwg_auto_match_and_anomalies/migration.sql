-- CreateEnum
CREATE TYPE "FileMappingSource" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('TIME_DISCREPANCY', 'PROJECT_MISMATCH', 'IDLE_SPIKE');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- DropForeignKey
ALTER TABLE "FileMapping" DROP CONSTRAINT "FileMapping_createdById_fkey";

-- AlterTable
ALTER TABLE "FileMapping" ADD COLUMN     "source" "FileMappingSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "createdById" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "type" "AnomalyType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "AnomalyStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anomaly_companyId_idx" ON "Anomaly"("companyId");

-- CreateIndex
CREATE INDEX "Anomaly_employeeId_idx" ON "Anomaly"("employeeId");

-- CreateIndex
CREATE INDEX "Anomaly_status_idx" ON "Anomaly"("status");

-- CreateIndex
CREATE INDEX "Anomaly_type_idx" ON "Anomaly"("type");

-- CreateIndex
CREATE INDEX "Anomaly_periodStart_idx" ON "Anomaly"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Anomaly_companyId_fingerprint_key" ON "Anomaly"("companyId", "fingerprint");

-- CreateIndex
CREATE INDEX "FileMapping_source_idx" ON "FileMapping"("source");

-- AddForeignKey
ALTER TABLE "FileMapping" ADD CONSTRAINT "FileMapping_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "IntegrationMapping_companyId_provider_externalEntityType_extern" RENAME TO "IntegrationMapping_companyId_provider_externalEntityType_ex_key";

-- RenameIndex
ALTER INDEX "IntegrationMapping_companyId_provider_internalEntityType_intern" RENAME TO "IntegrationMapping_companyId_provider_internalEntityType_in_idx";
