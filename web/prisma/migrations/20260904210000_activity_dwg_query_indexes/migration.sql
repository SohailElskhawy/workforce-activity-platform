-- CreateIndex
CREATE INDEX "Activity_companyId_type_startAt_idx" ON "Activity"("companyId", "type", "startAt");

-- CreateIndex
CREATE INDEX "Activity_companyId_fileName_idx" ON "Activity"("companyId", "fileName");
