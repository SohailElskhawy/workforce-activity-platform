-- AlterEnum
ALTER TYPE "IntegrationStatus" ADD VALUE 'CONFIGURED';

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "notificationDueSoonHours" INTEGER NOT NULL DEFAULT 24,
    "defaultIdleThresholdSeconds" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
