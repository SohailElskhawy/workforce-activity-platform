import "server-only";

import { tenantWhere, type AuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/src/generated/prisma/enums";

export type NotificationType = "TASK_DEADLINE_APPROACHING" | "TASK_OVERDUE";

export type TaskNotification = {
  id: string;
  type: NotificationType;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  dueDate: string;
  hoursDifference: number;
  assignees?: Array<{ id: string; name: string }>;
  createdAt: string;
};

import { getSystemSettingsWithStore } from "@/lib/services/system-settings";

export async function getTaskNotifications(
  context: AuthContext,
  now: Date = new Date(),
  dueSoonHours?: number,
): Promise<TaskNotification[]> {
  if (!context.companyId) return [];

  let windowHours = dueSoonHours;
  if (windowHours === undefined) {
    try {
      const settings = await getSystemSettingsWithStore();
      windowHours = settings.notificationDueSoonHours;
    } catch {
      windowHours = 24;
    }
  }

  const nowTime = now.getTime();
  const windowDueSoon = new Date(nowTime + windowHours * 60 * 60 * 1000);

  const whereBase: Record<string, unknown> = {
    status: {
      notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
    },
    dueDate: {
      not: null,
      lte: windowDueSoon,
    },
  };

  if (context.role === "EMPLOYEE") {
    if (!context.employeeId) return [];
    whereBase.assignments = { some: { employeeId: context.employeeId } };
  }

  const tasks = await prisma.task.findMany({
    where: tenantWhere(context.companyId, whereBase),
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      project: { select: { id: true, code: true, name: true } },
      assignments: {
        select: {
          employee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const notifications: TaskNotification[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const dueTime = new Date(task.dueDate).getTime();
    const diffHours = Math.round((dueTime - nowTime) / (60 * 60 * 1000));

    if (dueTime < nowTime) {
      notifications.push({
        id: `overdue-${task.id}`,
        type: "TASK_OVERDUE",
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.project.id,
        projectCode: task.project.code,
        projectName: task.project.name,
        dueDate: task.dueDate.toISOString(),
        hoursDifference: Math.max(1, Math.abs(diffHours)),
        assignees: task.assignments.map((a) => ({
          id: a.employee.id,
          name: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
        })),
        createdAt: task.dueDate.toISOString(),
      });
    } else {
      notifications.push({
        id: `approaching-${task.id}`,
        type: "TASK_DEADLINE_APPROACHING",
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.project.id,
        projectCode: task.project.code,
        projectName: task.project.name,
        dueDate: task.dueDate.toISOString(),
        hoursDifference: Math.max(1, diffHours),
        assignees: task.assignments.map((a) => ({
          id: a.employee.id,
          name: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
        })),
        createdAt: task.dueDate.toISOString(),
      });
    }
  }

  return notifications.sort((a, b) => {
    if (a.type === "TASK_OVERDUE" && b.type !== "TASK_OVERDUE") return -1;
    if (a.type !== "TASK_OVERDUE" && b.type === "TASK_OVERDUE") return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}
