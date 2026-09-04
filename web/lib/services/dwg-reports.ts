import { normalizeFileName } from "@/lib/agent/file-name";
import type { AuthContext } from "@/lib/auth-context";

export type DwgActivityRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  applicationName: string | null;
  fileName: string | null;
  durationSeconds: number;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  taskId: string | null;
  taskTitle: string | null;
  startAt: Date;
  endAt: Date;
};

export type DwgSummaryRow = {
  employeeId: string;
  employeeName: string;
  fileName: string;
  normalizedFileName: string;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  taskId: string | null;
  taskTitle: string | null;
  activeSeconds: number;
  isMapped: boolean;
};

export type UnmappedDwgFile = {
  fileName: string;
  normalizedFileName: string;
  employees: Array<{ id: string; name: string }>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  activeSeconds: number;
};

export function isDwgFile(fileName: string | null | undefined): boolean {
  if (!fileName || typeof fileName !== "string") return false;
  return normalizeFileName(fileName).endsWith(".dwg");
}

export function extractDisplayFileName(fileName: string): string {
  const normalizedPath = fileName.trim().replaceAll("/", "\\");
  const segments = normalizedPath.split("\\");
  const baseName = segments.at(-1) ?? fileName;
  return baseName.replace(/\*+$/, "").trim();
}

export function parseSafeDate(rawDay?: string | Date | null): Date {
  if (!rawDay) return new Date();
  if (rawDay instanceof Date) {
    return Number.isNaN(rawDay.getTime()) ? new Date() : rawDay;
  }
  const trimmed = rawDay.trim();
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed);
  if (!match) return new Date();
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dayBounds(day: Date) {
  const startAt = new Date(day);
  startAt.setHours(0, 0, 0, 0);
  const endAt = new Date(startAt);
  endAt.setDate(endAt.getDate() + 1);
  return { startAt, endAt };
}

export function aggregateDwgActivities(
  activities: Array<{
    employeeId: string;
    employeeName: string;
    type: string;
    applicationName: string | null;
    fileName: string | null;
    durationSeconds: number;
    projectId: string | null;
    projectName: string | null;
    projectCode: string | null;
    taskId: string | null;
    taskTitle: string | null;
  }>,
): DwgSummaryRow[] {
  const groups = new Map<string, DwgSummaryRow>();

  for (const activity of activities) {
    // 1. Only APPLICATION activity counts. IDLE must not count.
    if (activity.type !== "APPLICATION") continue;

    // 2. Must be a DWG file. Chrome, etc. do not count.
    if (!isDwgFile(activity.fileName)) continue;

    const normalized = normalizeFileName(activity.fileName!);
    const displayFileName = extractDisplayFileName(activity.fileName!);

    const groupKey = `${activity.employeeId}:${normalized}:${activity.projectId ?? ""}:${activity.taskId ?? ""}`;

    const existing = groups.get(groupKey);
    if (existing) {
      existing.activeSeconds += activity.durationSeconds;
    } else {
      groups.set(groupKey, {
        employeeId: activity.employeeId,
        employeeName: activity.employeeName,
        fileName: displayFileName,
        normalizedFileName: normalized,
        projectId: activity.projectId,
        projectName: activity.projectName,
        projectCode: activity.projectCode,
        taskId: activity.taskId,
        taskTitle: activity.taskTitle,
        activeSeconds: activity.durationSeconds,
        isMapped: Boolean(activity.projectId),
      });
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      b.activeSeconds - a.activeSeconds ||
      a.employeeName.localeCompare(b.employeeName) ||
      a.fileName.localeCompare(b.fileName),
  );
}

export function aggregateUnmappedDwgFiles(
  activities: Array<{
    employeeId: string;
    employeeName: string;
    type: string;
    fileName: string | null;
    durationSeconds: number;
    projectId: string | null;
    startAt: Date;
    endAt: Date;
  }>,
  mappedFileNames: Set<string> = new Set(),
): UnmappedDwgFile[] {
  const unmapped = new Map<
    string,
    {
      fileName: string;
      normalizedFileName: string;
      employeeMap: Map<string, string>;
      firstSeenAt: Date;
      lastSeenAt: Date;
      activeSeconds: number;
    }
  >();

  for (const activity of activities) {
    if (activity.type !== "APPLICATION") continue;
    if (!isDwgFile(activity.fileName)) continue;

    const normalized = normalizeFileName(activity.fileName!);
    if (activity.projectId || mappedFileNames.has(normalized)) continue;

    const displayFileName = extractDisplayFileName(activity.fileName!);
    const existing = unmapped.get(normalized);

    if (existing) {
      existing.activeSeconds += activity.durationSeconds;
      existing.employeeMap.set(activity.employeeId, activity.employeeName);
      if (activity.startAt < existing.firstSeenAt) {
        existing.firstSeenAt = activity.startAt;
      }
      if (activity.endAt > existing.lastSeenAt) {
        existing.lastSeenAt = activity.endAt;
      }
    } else {
      const employeeMap = new Map<string, string>();
      employeeMap.set(activity.employeeId, activity.employeeName);
      unmapped.set(normalized, {
        fileName: displayFileName,
        normalizedFileName: normalized,
        employeeMap,
        firstSeenAt: new Date(activity.startAt),
        lastSeenAt: new Date(activity.endAt),
        activeSeconds: activity.durationSeconds,
      });
    }
  }

  return Array.from(unmapped.values())
    .map((item) => ({
      fileName: item.fileName,
      normalizedFileName: item.normalizedFileName,
      employees: Array.from(item.employeeMap.entries()).map(([id, name]) => ({
        id,
        name,
      })),
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      activeSeconds: item.activeSeconds,
    }))
    .sort(
      (a, b) =>
        b.activeSeconds - a.activeSeconds ||
        a.fileName.localeCompare(b.fileName),
    );
}

export async function getManagerDwgReport(
  context: AuthContext,
  options: {
    day?: Date | string | null;
    employeeId?: string | null;
    projectId?: string | null;
  } = {},
) {
  const { prisma } = await import("@/lib/prisma");
  const selectedDate = parseSafeDate(options.day);
  const { startAt, endAt } = dayBounds(selectedDate);

  const whereClause: Record<string, unknown> = {
    companyId: context.companyId,
    type: "APPLICATION",
    fileName: { not: null },
    startAt: { gte: startAt, lt: endAt },
  };

  if (options.employeeId) {
    whereClause.employeeId = options.employeeId;
  }
  if (options.projectId) {
    whereClause.projectId = options.projectId;
  }

  const activities = await prisma.activity.findMany({
    where: whereClause,
    select: {
      id: true,
      employeeId: true,
      type: true,
      applicationName: true,
      fileName: true,
      durationSeconds: true,
      projectId: true,
      taskId: true,
      startAt: true,
      endAt: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { startAt: "asc" },
  });

  const flatActivities = activities.map((act) => ({
    employeeId: act.employeeId,
    employeeName: `${act.employee.firstName} ${act.employee.lastName}`.trim(),
    type: act.type,
    applicationName: act.applicationName,
    fileName: act.fileName,
    durationSeconds: act.durationSeconds,
    projectId: act.projectId,
    projectName: act.project?.name ?? null,
    projectCode: act.project?.code ?? null,
    taskId: act.taskId,
    taskTitle: act.task?.title ?? null,
  }));

  const rows = aggregateDwgActivities(flatActivities);
  return {
    date: formatDayString(selectedDate),
    rows,
  };
}

export async function getUnmappedDwgFiles(context: AuthContext) {
  const { prisma } = await import("@/lib/prisma");

  const [activities, existingMappings] = await Promise.all([
    prisma.activity.findMany({
      where: {
        companyId: context.companyId,
        type: "APPLICATION",
        fileName: { not: null },
        projectId: null,
      },
      select: {
        id: true,
        employeeId: true,
        type: true,
        applicationName: true,
        fileName: true,
        durationSeconds: true,
        projectId: true,
        startAt: true,
        endAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.fileMapping.findMany({
      where: { companyId: context.companyId },
      select: { normalizedFileName: true },
    }),
  ]);

  const mappedSet = new Set(existingMappings.map((m) => m.normalizedFileName));

  const flatActivities = activities.map((act) => ({
    employeeId: act.employeeId,
    employeeName: `${act.employee.firstName} ${act.employee.lastName}`.trim(),
    type: act.type,
    fileName: act.fileName,
    durationSeconds: act.durationSeconds,
    projectId: act.projectId,
    startAt: act.startAt,
    endAt: act.endAt,
  }));

  return aggregateUnmappedDwgFiles(flatActivities, mappedSet);
}
