-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "positionId" TEXT;

-- Preserve existing employee labels by making one position per normalized company/name pair.
INSERT INTO "Position" ("id", "companyId", "name", "createdAt", "updatedAt")
SELECT
    'legacy-position-' || md5("companyId" || ':' || lower(btrim("position"))),
    "companyId",
    btrim("position"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Employee"
WHERE "position" IS NOT NULL AND btrim("position") <> ''
GROUP BY "companyId", btrim("position"), lower(btrim("position"));

UPDATE "Employee" AS employee
SET "positionId" = position."id"
FROM "Position" AS position
WHERE position."companyId" = employee."companyId"
  AND lower(position."name") = lower(btrim(employee."position"));

-- CreateIndex
CREATE UNIQUE INDEX "Position_companyId_name_key" ON "Position"("companyId", "name");

-- CreateIndex
CREATE INDEX "Position_companyId_idx" ON "Position"("companyId");

-- CreateIndex
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
