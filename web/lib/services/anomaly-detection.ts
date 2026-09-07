import type { AuthContext } from "@/lib/auth-context";
import { assertRole, tenantWhere } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type {
  AnomalySeverity,
  AnomalyStatus,
  AnomalyType,
  Prisma,
} from "@/src/generated/prisma/client";
import {
  TIME_DISCREPANCY_MIN_DIFF_MINUTES,
  TIME_DISCREPANCY_LOW_MINUTES,
  TIME_DISCREPANCY_MEDIUM_MINUTES,
  TIME_DISCREPANCY_HIGH_MINUTES,
  PROJECT_MISMATCH_MIN_OVERLAP_SECONDS,
  PROJECT_MISMATCH_LOW_SECONDS,
  PROJECT_MISMATCH_MEDIUM_SECONDS,
  PROJECT_MISMATCH_HIGH_SECONDS,
  IDLE_SPIKE_RATIO_THRESHOLD,
  IDLE_SPIKE_MIN_IDLE_SECONDS,
  IDLE_SPIKE_MIN_OBSERVED_SECONDS,
} from "./anomaly-constants";
import { getZonedDayBounds } from "@/lib/time/timezone";

export type DetectedAnomalyDraft = {
  employeeId: string;
  projectId?: string | null;
  taskId?: string | null;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  fingerprint: string;
  periodStart: Date;
  periodEnd: Date;
  metadata: Prisma.InputJsonValue;
};

export function calculateIntervalOverlapSeconds(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): number {
  const start = Math.max(startA.getTime(), startB.getTime());
  const end = Math.min(endA.getTime(), endB.getTime());
  const diffMs = end - start;
  return diffMs > 0 ? Math.floor(diffMs / 1000) : 0;
}

export function getTimeDiscrepancySeverity(
  diffMinutes: number,
): AnomalySeverity {
  const abs = Math.abs(diffMinutes);
  if (abs >= TIME_DISCREPANCY_HIGH_MINUTES) return "HIGH";
  if (abs >= TIME_DISCREPANCY_MEDIUM_MINUTES) return "MEDIUM";
  return "LOW";
}

export function getProjectMismatchSeverity(
  overlapSeconds: number,
): AnomalySeverity {
  if (overlapSeconds >= PROJECT_MISMATCH_HIGH_SECONDS) return "HIGH";
  if (overlapSeconds >= PROJECT_MISMATCH_MEDIUM_SECONDS) return "MEDIUM";
  return "LOW";
}

export function getIdleSpikeSeverity(idleRatio: number): AnomalySeverity {
  if (idleRatio >= 0.6) return "HIGH";
  if (idleRatio >= 0.5) return "MEDIUM";
  return "LOW";
}

function formatMinutes(mins: number): string {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `${h}h ${m < 10 ? "0" : ""}${m}m`;
}

function formatSeconds(secs: number): string {
  const abs = Math.abs(secs);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return `${h}h ${m < 10 ? "0" : ""}${m}m`;
}

export type AnomalyFilters = {
  employeeId?: string;
  projectId?: string;
  type?: AnomalyType;
  severity?: AnomalySeverity;
  status?: AnomalyStatus;
  startDate?: string | Date;
  endDate?: string | Date;
  page?: number;
  pageSize?: number;
};

export async function listAnomalies(
  context: AuthContext,
  filters: AnomalyFilters = {},
  db = prisma,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.AnomalyWhereInput = {
    companyId: context.companyId,
  };

  if (filters.employeeId) whereClause.employeeId = filters.employeeId;
  if (filters.projectId) whereClause.projectId = filters.projectId;
  if (filters.type) whereClause.type = filters.type;
  if (filters.severity) whereClause.severity = filters.severity;
  if (filters.status) whereClause.status = filters.status;

  if (filters.startDate || filters.endDate) {
    whereClause.periodStart = {};
    if (filters.startDate) {
      whereClause.periodStart.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      whereClause.periodStart.lte = new Date(filters.endDate);
    }
  }

  const [items, total, countsByType, countsByStatus] = await Promise.all([
    db.anomaly.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: { select: { id: true, code: true, name: true } },
        task: { select: { id: true, title: true } },
        resolvedBy: { select: { id: true, email: true } },
      },
      orderBy: [{ status: "asc" }, { periodStart: "desc" }],
      skip,
      take: pageSize,
    }),
    db.anomaly.count({ where: whereClause }),
    db.anomaly.groupBy({
      by: ["type"],
      where: { companyId: context.companyId },
      _count: true,
    }),
    db.anomaly.groupBy({
      by: ["status"],
      where: { companyId: context.companyId },
      _count: true,
    }),
  ]);

  const kpis = {
    total,
    open: countsByStatus.find((s) => s.status === "OPEN")?._count ?? 0,
    acknowledged:
      countsByStatus.find((s) => s.status === "ACKNOWLEDGED")?._count ?? 0,
    resolved: countsByStatus.find((s) => s.status === "RESOLVED")?._count ?? 0,
    dismissed:
      countsByStatus.find((s) => s.status === "DISMISSED")?._count ?? 0,
    timeDiscrepancy:
      countsByType.find((t) => t.type === "TIME_DISCREPANCY")?._count ?? 0,
    projectMismatch:
      countsByType.find((t) => t.type === "PROJECT_MISMATCH")?._count ?? 0,
    idleSpike: countsByType.find((t) => t.type === "IDLE_SPIKE")?._count ?? 0,
  };

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    kpis,
  };
}

export async function scanAnomalies(
  context: AuthContext,
  options: {
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    employeeId?: string | null;
  } = {},
  db = prisma,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const now = new Date();
  const rawEnd = options.endDate ? new Date(options.endDate) : now;
  const rawStart = options.startDate
    ? new Date(options.startDate)
    : new Date(rawEnd.getTime() - 7 * 86400000); // default last 7 days

  const startDate = Number.isNaN(rawStart.getTime())
    ? new Date(now.getTime() - 7 * 86400000)
    : rawStart;
  const endDate = Number.isNaN(rawEnd.getTime()) ? now : rawEnd;

  // Bounded scan range (max 90 days)
  const maxRangeMs = 90 * 86400000;
  const clampedStart =
    endDate.getTime() - startDate.getTime() > maxRangeMs
      ? new Date(endDate.getTime() - maxRangeMs)
      : startDate;

  // 1. Fetch relevant manual TimeEntries in date range
  const timeEntriesWhere: Prisma.TimeEntryWhereInput = {
    companyId: context.companyId,
    startAt: { gte: clampedStart, lte: endDate },
  };
  if (options.employeeId) {
    timeEntriesWhere.employeeId = options.employeeId;
  }

  // 2. Fetch relevant Activities in date range
  const activitiesWhere: Prisma.ActivityWhereInput = {
    companyId: context.companyId,
    startAt: { gte: clampedStart, lte: endDate },
  };
  if (options.employeeId) {
    activitiesWhere.employeeId = options.employeeId;
  }

  const [timeEntries, activities, employees, projects] = await Promise.all([
    db.timeEntry.findMany({
      where: timeEntriesWhere,
      include: {
        project: { select: { id: true, code: true, name: true } },
        task: { select: { id: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    db.activity.findMany({
      where: activitiesWhere,
      include: {
        project: { select: { id: true, code: true, name: true } },
        task: { select: { id: true, title: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    db.employee.findMany({
      where: tenantWhere(context.companyId, {}),
      select: { id: true, firstName: true, lastName: true },
    }),
    db.project.findMany({
      where: tenantWhere(context.companyId, {}),
      select: { id: true, code: true, name: true },
    }),
  ]);

  const drafts: DetectedAnomalyDraft[] = [];

  // =========================================================================
  // TYPE 1: TIME_DISCREPANCY
  // Requirement 12 & 15:
  // - Compare Manual Time vs Activity Time
  // - Neutral language without accusatory labels
  // - Scope by employee + calendar day + project (where manual entry exists)
  // - Absolute difference >= 90 minutes
  // =========================================================================
  type DailyComparisonKey = `${string}:${string}:${string}`; // employeeId:dayStr:projectId
  const dailyManual = new Map<
    DailyComparisonKey,
    {
      employeeId: string;
      dayStr: string;
      projectId: string;
      projectName: string;
      projectCode: string;
      manualMinutes: number;
      dayStart: Date;
      dayEnd: Date;
    }
  >();

  for (const entry of timeEntries) {
    const { dayStr, startAt, endAt } = getZonedDayBounds(entry.startAt);
    const key: DailyComparisonKey = `${entry.employeeId}:${dayStr}:${entry.projectId}`;
    const existing = dailyManual.get(key);
    if (existing) {
      existing.manualMinutes += entry.durationMinutes;
    } else {
      dailyManual.set(key, {
        employeeId: entry.employeeId,
        dayStr,
        projectId: entry.projectId,
        projectName: entry.project?.name ?? "Project",
        projectCode: entry.project?.code ?? "",
        manualMinutes: entry.durationMinutes,
        dayStart: startAt,
        dayEnd: endAt,
      });
    }
  }

  // Aggregate confirmed APPLICATION activity minutes for the same employee + day + project
  const dailyActivity = new Map<DailyComparisonKey, number>();
  for (const act of activities) {
    if (act.type !== "APPLICATION" || !act.projectId) continue;
    const { dayStr } = getZonedDayBounds(act.startAt);
    const key: DailyComparisonKey = `${act.employeeId}:${dayStr}:${act.projectId}`;
    const currentSeconds = dailyActivity.get(key) ?? 0;
    dailyActivity.set(key, currentSeconds + act.durationSeconds);
  }

  for (const [key, manualRecord] of dailyManual.entries()) {
    const activeSeconds = dailyActivity.get(key) ?? 0;
    const activeMinutes = Math.round(activeSeconds / 60);
    const diffMinutes = manualRecord.manualMinutes - activeMinutes; // signed difference

    if (Math.abs(diffMinutes) >= TIME_DISCREPANCY_MIN_DIFF_MINUTES) {
      const severity = getTimeDiscrepancySeverity(diffMinutes);
      const fingerprint = `TD:${manualRecord.employeeId}:${manualRecord.dayStr}:${manualRecord.projectId}`;

      drafts.push({
        employeeId: manualRecord.employeeId,
        projectId: manualRecord.projectId,
        type: "TIME_DISCREPANCY",
        severity,
        title: `Time difference on ${manualRecord.projectCode || manualRecord.projectName}`,
        description: `Manual time logged (${formatMinutes(manualRecord.manualMinutes)}) differs from measured desktop activity (${formatMinutes(activeMinutes)}) by ${formatMinutes(diffMinutes)} on ${manualRecord.dayStr}. This difference may require review.`,
        fingerprint,
        periodStart: manualRecord.dayStart,
        periodEnd: manualRecord.dayEnd,
        metadata: {
          manualMinutes: manualRecord.manualMinutes,
          activeMinutes,
          differenceMinutes: diffMinutes,
          dayStr: manualRecord.dayStr,
          projectCode: manualRecord.projectCode,
          projectName: manualRecord.projectName,
        },
      });
    }
  }

  // =========================================================================
  // TYPE 2: PROJECT_MISMATCH
  // Requirement 12 & 16:
  // - Temporal overlap between Manual Entry for Project A and Confirmed Mapped Activity for Project B
  // - Overlap duration >= 30 minutes (PROJECT_MISMATCH_MIN_OVERLAP_SECONDS)
  // - ONLY confirmed mapped activity (act.projectId !== null)
  // - Pure interval intersection logic
  // =========================================================================
  for (const manual of timeEntries) {
    if (!manual.projectId) continue;

    // Look for overlapping activities from the same employee
    for (const act of activities) {
      if (act.employeeId !== manual.employeeId) continue;
      // Requirement 12: Must be confirmed mapped activity on a DIFFERENT project
      if (!act.projectId || act.projectId === manual.projectId) continue;
      if (act.type !== "APPLICATION") continue;

      const overlapSeconds = calculateIntervalOverlapSeconds(
        manual.startAt,
        manual.endAt,
        act.startAt,
        act.endAt,
      );

      if (overlapSeconds >= PROJECT_MISMATCH_MIN_OVERLAP_SECONDS) {
        const severity = getProjectMismatchSeverity(overlapSeconds);
        // Requirement 10: Deterministic fingerprint capturing employee, day, expected, detected, and overlap window
        const { dayStr } = getZonedDayBounds(manual.startAt);
        const windowKey = `${Math.floor(manual.startAt.getTime() / 1000)}_${Math.floor(manual.endAt.getTime() / 1000)}`;
        const fingerprint = `PM:${manual.employeeId}:${dayStr}:${manual.projectId}:${act.projectId}:${windowKey}`;

        drafts.push({
          employeeId: manual.employeeId,
          projectId: manual.projectId,
          taskId: manual.taskId,
          type: "PROJECT_MISMATCH",
          severity,
          title: `Project overlap: ${manual.project?.code || "Manual"} vs ${act.project?.code || "Activity"}`,
          description: `Manual time was logged for ${manual.project?.name ?? "Project A"} (${manual.project?.code ?? ""}), but ${formatSeconds(overlapSeconds)} of confirmed active computer tracking on ${act.project?.name ?? "Project B"} (${act.project?.code ?? ""}) was recorded during the same window.`,
          fingerprint,
          periodStart: manual.startAt,
          periodEnd: manual.endAt,
          metadata: {
            manualProjectId: manual.projectId,
            manualProjectCode: manual.project?.code ?? null,
            manualProjectName: manual.project?.name ?? null,
            detectedProjectId: act.projectId,
            detectedProjectCode: act.project?.code ?? null,
            detectedProjectName: act.project?.name ?? null,
            detectedFileName: act.fileName ?? null,
            overlapSeconds,
            manualStartAt: manual.startAt.toISOString(),
            manualEndAt: manual.endAt.toISOString(),
          },
        });
      }
    }
  }

  // =========================================================================
  // TYPE 3: IDLE_SPIKE
  // Requirement 14:
  // - Evaluated as idleRatio = idleSeconds / (activeSeconds + idleSeconds)
  // - Minimum total observed seconds >= 7200 (2h)
  // - Minimum idle seconds >= 5400 (90 min)
  // - Idle ratio >= 0.40 (40%)
  // - Neutral wording
  // =========================================================================
  type DailyEmployeeKey = `${string}:${string}`; // employeeId:dayStr
  const dailyTotals = new Map<
    DailyEmployeeKey,
    {
      employeeId: string;
      dayStr: string;
      activeSeconds: number;
      idleSeconds: number;
      dayStart: Date;
      dayEnd: Date;
    }
  >();

  for (const act of activities) {
    const { dayStr, startAt, endAt } = getZonedDayBounds(act.startAt);
    const key: DailyEmployeeKey = `${act.employeeId}:${dayStr}`;
    const record = dailyTotals.get(key) ?? {
      employeeId: act.employeeId,
      dayStr,
      activeSeconds: 0,
      idleSeconds: 0,
      dayStart: startAt,
      dayEnd: endAt,
    };

    if (act.type === "APPLICATION") {
      record.activeSeconds += act.durationSeconds;
    } else if (act.type === "IDLE") {
      record.idleSeconds += act.durationSeconds;
    }
    dailyTotals.set(key, record);
  }

  for (const [key, record] of dailyTotals.entries()) {
    const totalObservedSeconds = record.activeSeconds + record.idleSeconds;
    if (totalObservedSeconds >= IDLE_SPIKE_MIN_OBSERVED_SECONDS) {
      const idleRatio = record.idleSeconds / totalObservedSeconds;
      if (
        idleRatio >= IDLE_SPIKE_RATIO_THRESHOLD &&
        record.idleSeconds >= IDLE_SPIKE_MIN_IDLE_SECONDS
      ) {
        const severity = getIdleSpikeSeverity(idleRatio);
        const fingerprint = `IS:${record.employeeId}:${record.dayStr}`;
        const pct = Math.round(idleRatio * 100);

        drafts.push({
          employeeId: record.employeeId,
          type: "IDLE_SPIKE",
          severity,
          title: `High inactivity ratio on ${record.dayStr}`,
          description: `Recorded inactivity was ${formatSeconds(record.idleSeconds)} (${pct}% of observed ${formatSeconds(totalObservedSeconds)} computer session) on ${record.dayStr}.`,
          fingerprint,
          periodStart: record.dayStart,
          periodEnd: record.dayEnd,
          metadata: {
            dayStr: record.dayStr,
            activeSeconds: record.activeSeconds,
            idleSeconds: record.idleSeconds,
            totalObservedSeconds,
            idleRatio: Math.round(idleRatio * 1000) / 1000,
          },
        });
      }
    }
  }

  // =========================================================================
  // PERSISTENCE WITH HUMAN REVIEW PRESERVATION (Requirement 10 & 11)
  // - If fingerprint exists:
  //   - If status is OPEN: update title, description, metadata, severity
  //   - If status is ACKNOWLEDGED, RESOLVED, or DISMISSED: PRESERVE status, resolvedBy, resolvedAt, resolutionNotes
  // - If fingerprint does not exist: create with status OPEN
  // =========================================================================
  let createdCount = 0;
  let preservedCount = 0;
  let updatedCount = 0;

  for (const draft of drafts) {
    const existing = await db.anomaly.findUnique({
      where: {
        companyId_fingerprint: {
          companyId: context.companyId,
          fingerprint: draft.fingerprint,
        },
      },
    });

    if (!existing) {
      await db.anomaly.create({
        data: {
          companyId: context.companyId,
          employeeId: draft.employeeId,
          projectId: draft.projectId ?? null,
          taskId: draft.taskId ?? null,
          type: draft.type,
          severity: draft.severity,
          status: "OPEN",
          title: draft.title,
          description: draft.description,
          fingerprint: draft.fingerprint,
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
          metadata: draft.metadata,
        },
      });
      createdCount++;
    } else if (existing.status === "OPEN") {
      // Refresh details for open items without changing status
      await db.anomaly.update({
        where: { id: existing.id },
        data: {
          title: draft.title,
          description: draft.description,
          severity: draft.severity,
          metadata: draft.metadata,
        },
      });
      updatedCount++;
    } else {
      // Requirement 11: PRESERVE human review state! (ACKNOWLEDGED, RESOLVED, DISMISSED)
      preservedCount++;
    }
  }

  return {
    scannedRange: {
      startDate: clampedStart.toISOString(),
      endDate: endDate.toISOString(),
    },
    draftsFound: drafts.length,
    createdCount,
    updatedCount,
    preservedCount,
  };
}

export async function updateAnomalyReviewStatus(
  context: AuthContext,
  anomalyId: string,
  input: {
    status: AnomalyStatus;
    resolutionNotes?: string | null;
  },
  db = prisma,
) {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const anomaly = await db.anomaly.findFirst({
    where: tenantWhere(context.companyId, { id: anomalyId }),
  });
  if (!anomaly) {
    throw new ApiError("NOT_FOUND", "Anomaly not found.", 404);
  }

  const validStatuses: AnomalyStatus[] = [
    "OPEN",
    "ACKNOWLEDGED",
    "RESOLVED",
    "DISMISSED",
  ];
  if (!validStatuses.includes(input.status)) {
    throw new ApiError("VALIDATION_ERROR", "Invalid anomaly status.", 400);
  }

  const updated = await db.anomaly.update({
    where: { id: anomalyId },
    data: {
      status: input.status,
      resolutionNotes: input.resolutionNotes ?? null,
      resolvedById: input.status === "OPEN" ? null : context.userId,
      resolvedAt: input.status === "OPEN" ? null : new Date(),
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      project: { select: { id: true, code: true, name: true } },
      task: { select: { id: true, title: true } },
      resolvedBy: { select: { id: true, email: true } },
    },
  });

  // Requirement 21: Audit actions
  const auditActionMap: Record<AnomalyStatus, string> = {
    OPEN: "ANOMALY_REOPENED",
    ACKNOWLEDGED: "ANOMALY_ACKNOWLEDGED",
    RESOLVED: "ANOMALY_RESOLVED",
    DISMISSED: "ANOMALY_DISMISSED",
  };

  await writeAudit(db, {
    companyId: context.companyId,
    actorUserId: context.userId,
    action: auditActionMap[input.status],
    entityType: "Anomaly",
    entityId: updated.id,
    metadata: {
      type: updated.type,
      status: updated.status,
      employeeId: updated.employeeId,
      projectId: updated.projectId,
      resolutionNotes: input.resolutionNotes ?? null,
    },
  });

  return updated;
}
