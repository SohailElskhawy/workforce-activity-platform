-- AlterTable
ALTER TABLE "Company" ADD COLUMN "demoFixtureSet" TEXT,
ADD COLUMN "demoFixtureVersion" INTEGER;

-- CreateIndex
CREATE INDEX "Company_demoFixtureSet_idx" ON "Company"("demoFixtureSet");

-- Preserve reset ownership for the legacy fixture only when it contains the
-- distinctive demo manager account; ordinary companies with a similar name
-- remain untouched.
UPDATE "Company" AS company
SET "demoFixtureSet" = 'worklens-client-demo', "demoFixtureVersion" = 1
WHERE company."name" = 'WorkLens Demo Engineering'
  AND EXISTS (
    SELECT 1
    FROM "User" AS "user"
    WHERE "user"."companyId" = company."id"
      AND "user"."email" = 'manager@worklens.demo'
  );
