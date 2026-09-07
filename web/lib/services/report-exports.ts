import "server-only";

import { assertRole, tenantWhere, type AuthContext } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import {
  assertEmployeeActivityScope,
  getEmployeeDaySummary,
  getProjectActivitySummary,
  getTaskActivitySummary,
  manualActivityDifference,
  summarizeActivities,
} from "@/lib/services/activity-reports";
import { getZonedDayBounds } from "@/lib/time/timezone";

export type ExportType =
  | "employee"
  | "project"
  | "task"
  | "application"
  | "time-comparison";

export type ExportDataset = {
  sheetName: string;
  filenameBase: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
};

export async function getReportExportData(
  context: AuthContext,
  query: {
    type: ExportType;
    employeeId?: string | null;
    projectId?: string | null;
    taskId?: string | null;
    day?: string | null;
  },
): Promise<ExportDataset> {
  // Authorization check
  if (context.role === "EMPLOYEE") {
    if (query.type !== "employee" && query.type !== "application") {
      throw new ApiError(
        "FORBIDDEN",
        "Employees can only export their own reports.",
        403,
      );
    }
    if (query.employeeId && query.employeeId !== context.employeeId) {
      throw new ApiError(
        "FORBIDDEN",
        "You do not have access to this employee's activity.",
        403,
      );
    }
  } else {
    assertRole(context, ["MANAGER", "SUPER_ADMIN"]);
  }

  const { dayStr, startAt, endAt } = getZonedDayBounds(query.day ?? new Date());

  switch (query.type) {
    case "employee": {
      const targetEmployeeId =
        context.role === "EMPLOYEE"
          ? context.employeeId!
          : (query.employeeId ?? "");

      if (!targetEmployeeId) {
        throw new ApiError(
          "VALIDATION_ERROR",
          "employeeId is required for employee export.",
          400,
        );
      }

      assertEmployeeActivityScope(context, targetEmployeeId);
      const summary = await getEmployeeDaySummary(
        context,
        targetEmployeeId,
        query.day ?? undefined,
      );

      const headers = [
        "Employee",
        "Email",
        "Department",
        "Date",
        "Active Time (minutes)",
        "Idle Time (minutes)",
        "Manual Time (minutes)",
        "Difference (minutes)",
        "Online Status",
      ];

      const rows = [
        [
          summary.employee.name,
          summary.employee.email,
          summary.employee.department ?? "—",
          summary.selectedDate,
          Math.round(summary.activeSeconds / 60),
          Math.round(summary.idleSeconds / 60),
          summary.manualMinutes,
          summary.differenceMinutes,
          summary.employee.isOnline ? "Online" : "Offline",
        ],
      ];

      return {
        sheetName: "Employees",
        filenameBase: `worklens-employee-report-${dayStr}`,
        headers,
        rows,
      };
    }

    case "project": {
      const projects = query.projectId
        ? [await getProjectActivitySummary(context, query.projectId)]
        : await (async () => {
            const list = await prisma.project.findMany({
              where: tenantWhere(context.companyId, {}),
              select: { id: true },
            });
            return Promise.all(
              list.map((p) => getProjectActivitySummary(context, p.id)),
            );
          })();

      const headers = [
        "Project Code",
        "Project Name",
        "Estimated Hours",
        "Tracked Active Time (minutes)",
        "Manual Time (minutes)",
        "Difference (minutes)",
      ];

      const rows = projects.map((proj) => [
        proj.code,
        proj.name,
        proj.estimatedHours ?? "—",
        Math.round(proj.activeSeconds / 60),
        proj.manualMinutes,
        proj.differenceMinutes,
      ]);

      return {
        sheetName: "Projects",
        filenameBase: `worklens-project-report-${dayStr}`,
        headers,
        rows,
      };
    }

    case "task": {
      const tasks = query.taskId
        ? [await getTaskActivitySummary(context, query.taskId)]
        : await (async () => {
            const list = await prisma.task.findMany({
              where: tenantWhere(
                context.companyId,
                query.projectId ? { projectId: query.projectId } : {},
              ),
              select: { id: true },
            });
            return Promise.all(
              list.map((t) => getTaskActivitySummary(context, t.id)),
            );
          })();

      const headers = [
        "Task Title",
        "Project Code",
        "Project Name",
        "Estimated (minutes)",
        "Tracked Active Time (minutes)",
        "Manual Time (minutes)",
        "Difference (minutes)",
      ];

      const rows = tasks.map((tsk) => [
        tsk.title,
        tsk.project.code,
        tsk.project.name,
        tsk.estimatedMinutes ?? "—",
        Math.round(tsk.activeSeconds / 60),
        tsk.manualMinutes,
        tsk.differenceMinutes,
      ]);

      return {
        sheetName: "Tasks",
        filenameBase: `worklens-task-report-${dayStr}`,
        headers,
        rows,
      };
    }

    case "application": {
      const targetEmployeeId =
        context.role === "EMPLOYEE"
          ? context.employeeId!
          : (query.employeeId ?? null);

      if (targetEmployeeId) {
        assertEmployeeActivityScope(context, targetEmployeeId);
      }

      const activities = await prisma.activity.findMany({
        where: tenantWhere(context.companyId, {
          ...(targetEmployeeId ? { employeeId: targetEmployeeId } : {}),
          startAt: { gte: startAt, lt: endAt },
        }),
        select: {
          type: true,
          durationSeconds: true,
          applicationName: true,
        },
      });

      const totals = summarizeActivities(activities);
      const totalActiveSeconds = totals.activeSeconds;

      const headers = [
        "Application",
        "Active Time (minutes)",
        "Active Time (seconds)",
        "Share (%)",
      ];

      const rows = totals.applications.map((app) => [
        app.name,
        Math.round(app.durationSeconds / 60),
        app.durationSeconds,
        totalActiveSeconds > 0
          ? Number(((app.durationSeconds / totalActiveSeconds) * 100).toFixed(1))
          : 0,
      ]);

      return {
        sheetName: "Applications",
        filenameBase: `worklens-application-report-${dayStr}`,
        headers,
        rows,
      };
    }

    case "time-comparison": {
      assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

      const employees = await prisma.employee.findMany({
        where: tenantWhere(context.companyId, {}),
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          department: { select: { name: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      });

      const headers = [
        "Employee",
        "Email",
        "Department",
        "Date",
        "Manual Time (minutes)",
        "Tracked Active Time (minutes)",
        "Difference (minutes)",
        "Status",
      ];

      const rows = await Promise.all(
        employees.map(async (emp) => {
          const [manualAgg, activeAgg] = await Promise.all([
            prisma.timeEntry.aggregate({
              where: tenantWhere(context.companyId, {
                employeeId: emp.id,
                startAt: { gte: startAt, lt: endAt },
              }),
              _sum: { durationMinutes: true },
            }),
            prisma.activity.aggregate({
              where: tenantWhere(context.companyId, {
                employeeId: emp.id,
                type: "APPLICATION" as const,
                startAt: { gte: startAt, lt: endAt },
              }),
              _sum: { durationSeconds: true },
            }),
          ]);

          const manualMinutes = manualAgg._sum?.durationMinutes ?? 0;
          const activeSeconds = activeAgg._sum?.durationSeconds ?? 0;
          const activeMinutes = Math.round(activeSeconds / 60);
          const diff = manualActivityDifference(manualMinutes, activeSeconds);

          let status = "Match";
          if (diff > 0) status = `+${diff}m Manual`;
          else if (diff < 0) status = `+${Math.abs(diff)}m Tracked`;

          return [
            `${emp.firstName} ${emp.lastName}`.trim(),
            emp.email,
            emp.department?.name ?? "—",
            dayStr,
            manualMinutes,
            activeMinutes,
            diff,
            status,
          ];
        }),
      );

      return {
        sheetName: "Time Comparison",
        filenameBase: `worklens-time-comparison-report-${dayStr}`,
        headers,
        rows,
      };
    }
  }
}
