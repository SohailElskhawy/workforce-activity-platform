import { assertRole, type AuthContext } from "@/lib/auth-context";
import { decryptJson } from "@/lib/crypto/secret";
import { prisma } from "@/lib/prisma";
import type {
  ClickUpTask,
  ClickUpUser,
} from "@/lib/integrations/clickup/client";
import { ClickUpClient } from "@/lib/integrations/clickup/client";
import type {
  IntegrationMappingRecord,
  IntegrationRecord,
  IntegrationStore,
} from "@/lib/services/integrations";
import { defaultIntegrationStore } from "@/lib/services/integrations";
import type {
  Prisma,
  TaskPriority,
  TaskStatus,
} from "@/src/generated/prisma/client";

export function mapClickUpStatusToWorkLens(clickUpStatus: string): TaskStatus {
  const s = (clickUpStatus || "").trim().toLowerCase();
  if (s === "to do" || s === "todo" || s === "open" || s === "backlog") {
    return "TODO";
  }
  if (
    s === "in progress" ||
    s === "working" ||
    s === "active" ||
    s === "doing" ||
    s === "wip"
  ) {
    return "IN_PROGRESS";
  }
  if (s === "blocked" || s === "waiting" || s === "on hold") {
    return "BLOCKED";
  }
  if (s === "review" || s === "in review" || s === "under review" || s === "qa") {
    return "REVIEW";
  }
  if (
    s === "complete" ||
    s === "completed" ||
    s === "done" ||
    s === "closed" ||
    s === "finished"
  ) {
    return "COMPLETED";
  }
  if (s === "cancelled" || s === "canceled" || s === "rejected") {
    return "CANCELLED";
  }
  // Safe default: do NOT silently mark unknown external statuses COMPLETED
  return "TODO";
}

export function mapWorkLensStatusToClickUp(status: TaskStatus): string {
  switch (status) {
    case "TODO":
      return "to do";
    case "IN_PROGRESS":
      return "in progress";
    case "BLOCKED":
      return "blocked";
    case "REVIEW":
      return "in review";
    case "COMPLETED":
      return "complete";
    case "CANCELLED":
      return "cancelled";
  }
}

export function mapClickUpPriorityToWorkLens(priorityName?: string): TaskPriority {
  const p = (priorityName || "").trim().toLowerCase();
  if (p === "urgent") return "URGENT";
  if (p === "high") return "HIGH";
  if (p === "normal" || p === "medium") return "MEDIUM";
  if (p === "low") return "LOW";
  return "MEDIUM";
}

export type ClickUpSyncResult = {
  tasksProcessed: number;
  tasksCreated: number;
  tasksUpdated: number;
  assigneesMapped: number;
  errors: string[];
};

export type ClickUpSyncDatabase = {
  findIntegration(companyId: string): Promise<IntegrationRecord | null>;
  findMapping(
    companyId: string,
    externalType: string,
    externalId: string
  ): Promise<IntegrationMappingRecord | null>;
  findMappingByInternal(
    companyId: string,
    internalType: string,
    internalId: string
  ): Promise<IntegrationMappingRecord | null>;
  upsertMapping(
    companyId: string,
    externalType: string,
    externalId: string,
    internalType: string,
    internalId: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<IntegrationMappingRecord>;
  findDefaultProject(companyId: string, name?: string): Promise<{ id: string } | null>;
  createDefaultProject(companyId: string, name: string): Promise<{ id: string }>;
  findTask(companyId: string, taskId: string): Promise<{
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    dueDate: Date | null;
    estimatedMinutes: number | null;
    updatedAt: Date;
  } | null>;
  createTask(data: {
    companyId: string;
    projectId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: Date | null;
    estimatedMinutes?: number | null;
    createdById: string;
  }): Promise<{ id: string }>;
  updateTask(
    taskId: string,
    data: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: Date | null;
      estimatedMinutes?: number | null;
      completedAt?: Date | null;
    }
  ): Promise<{ id: string }>;
  findEmployeeByEmail(companyId: string, email: string): Promise<{ id: string } | null>;
  assignTask(taskId: string, employeeId: string, assignedById: string, companyId: string): Promise<void>;
  getUserForSystem(companyId: string): Promise<{ id: string } | null>;
};

export const defaultClickUpDatabase: ClickUpSyncDatabase = {
  async findIntegration(companyId) {
    return defaultIntegrationStore.findIntegration(companyId, "CLICKUP");
  },
  async findMapping(companyId, externalType, externalId) {
    return defaultIntegrationStore.findMapping(
      companyId,
      "CLICKUP",
      externalType,
      externalId
    );
  },
  async findMappingByInternal(companyId, internalType, internalId) {
    return defaultIntegrationStore.findMappingByInternal(
      companyId,
      "CLICKUP",
      internalType,
      internalId
    );
  },
  async upsertMapping(companyId, externalType, externalId, internalType, internalId, metadata) {
    return defaultIntegrationStore.upsertMapping(
      companyId,
      "CLICKUP",
      externalType,
      externalId,
      internalType,
      internalId,
      metadata
    );
  },
  async findDefaultProject(companyId, name) {
    if (name) {
      const found = await prisma.project.findFirst({
        where: { companyId, name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (found) return found;
    }
    const anyProject = await prisma.project.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return anyProject;
  },
  async createDefaultProject(companyId, name) {
    const user = await prisma.user.findFirst({
      where: { companyId, role: { in: ["MANAGER", "SUPER_ADMIN"] } },
      select: { id: true },
    });
    if (!user) throw new Error("No admin user found for company");

    const code = name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "P") + "-1";
    return prisma.project.create({
      data: {
        companyId,
        name,
        code,
        createdById: user.id,
      },
      select: { id: true },
    });
  },
  async findTask(companyId, taskId) {
    return prisma.task.findFirst({
      where: { id: taskId, companyId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        estimatedMinutes: true,
        updatedAt: true,
      },
    });
  },
  async createTask(data) {
    return prisma.task.create({
      data: {
        companyId: data.companyId,
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        estimatedMinutes: data.estimatedMinutes,
        createdById: data.createdById,
      },
      select: { id: true },
    });
  },
  async updateTask(taskId, data) {
    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.estimatedMinutes !== undefined
          ? { estimatedMinutes: data.estimatedMinutes }
          : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
      },
      select: { id: true },
    });
  },
  async findEmployeeByEmail(companyId, email) {
    return prisma.employee.findFirst({
      where: {
        companyId,
        email: { equals: email.toLowerCase(), mode: "insensitive" },
      },
      select: { id: true },
    });
  },
  async assignTask(taskId, employeeId, assignedById, companyId) {
    await prisma.taskAssignment.upsert({
      where: {
        taskId_employeeId: {
          taskId,
          employeeId,
        },
      },
      create: {
        companyId,
        taskId,
        employeeId,
        assignedById,
      },
      update: {},
    });
  },
  async getUserForSystem(companyId) {
    return prisma.user.findFirst({
      where: { companyId, role: { in: ["MANAGER", "SUPER_ADMIN"] } },
      select: { id: true },
    });
  },
};

export async function syncClickUpInbound(
  context: AuthContext,
  options: {
    listId?: string;
    client?: ClickUpClient;
    db?: ClickUpSyncDatabase;
  } = {}
): Promise<ClickUpSyncResult> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);
  const db = options.db ?? defaultClickUpDatabase;

  const integration = await db.findIntegration(context.companyId);
  if (!integration || !integration.encryptedCredentials) {
    throw new Error("ClickUp integration is not configured");
  }

  const { apiToken } = decryptJson<{ apiToken: string }>(
    integration.encryptedCredentials
  );

  const client = options.client ?? new ClickUpClient({ apiToken });
  const config = (integration.config as Record<string, unknown>) ?? {};
  const targetListId = options.listId || (config.listId as string);

  if (!targetListId) {
    throw new Error(
      "No ClickUp List ID specified or configured. Please provide a listId to sync."
    );
  }

  const systemUser = await db.getUserForSystem(context.companyId);
  if (!systemUser) {
    throw new Error("Cannot sync tasks: no manager user found in company");
  }

  // Find or create default project for this list
  let project = await db.findDefaultProject(context.companyId);
  if (!project) {
    project = await db.createDefaultProject(context.companyId, "ClickUp Imported");
  }

  const result: ClickUpSyncResult = {
    tasksProcessed: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    assigneesMapped: 0,
    errors: [],
  };

  let page = 0;
  let hasMore = true;

  while (hasMore && page < 20) {
    const { tasks, lastPage } = await client.getTasks(targetListId, page);
    for (const cuTask of tasks) {
      try {
        result.tasksProcessed++;

        const mapping = await db.findMapping(context.companyId, "TASK", cuTask.id);
        const status = mapClickUpStatusToWorkLens(cuTask.status?.status);
        const priority = mapClickUpPriorityToWorkLens(cuTask.priority?.priority);
        const dueDate = cuTask.due_date
          ? new Date(parseInt(cuTask.due_date, 10))
          : null;
        const estimatedMinutes = cuTask.time_estimate
          ? Math.round(cuTask.time_estimate / 60000)
          : null;
        const completedAt = status === "COMPLETED" ? new Date() : null;

        let internalTaskId: string;

        if (mapping) {
          await db.updateTask(mapping.internalId, {
            title: cuTask.name,
            description: cuTask.description || cuTask.text_content || undefined,
            status,
            priority,
            dueDate,
            estimatedMinutes,
            completedAt,
          });
          internalTaskId = mapping.internalId;
          result.tasksUpdated++;
        } else {
          const created = await db.createTask({
            companyId: context.companyId,
            projectId: project.id,
            title: cuTask.name,
            description: cuTask.description || cuTask.text_content || undefined,
            status,
            priority,
            dueDate,
            estimatedMinutes,
            createdById: systemUser.id,
          });
          internalTaskId = created.id;
          result.tasksCreated++;
        }

        // Persist mapping with sync origin timestamp for loop prevention
        await db.upsertMapping(
          context.companyId,
          "TASK",
          cuTask.id,
          "Task",
          internalTaskId,
          {
            lastSyncedAt: new Date().toISOString(),
            externalUpdated: cuTask.date_updated,
            direction: "INBOUND",
          } as Prisma.InputJsonValue
        );

        // Map assignees
        if (cuTask.assignees && cuTask.assignees.length > 0) {
          for (const assignee of cuTask.assignees) {
            if (!assignee.email) continue;
            const employee = await db.findEmployeeByEmail(
              context.companyId,
              assignee.email
            );
            if (employee) {
              await db.assignTask(
                internalTaskId,
                employee.id,
                systemUser.id,
                context.companyId
              );
              await db.upsertMapping(
                context.companyId,
                "USER",
                String(assignee.id),
                "Employee",
                employee.id,
                { email: assignee.email } as Prisma.InputJsonValue
              );
              result.assigneesMapped++;
            }
          }
        }
      } catch (err) {
        result.errors.push(
          `Task ${cuTask.id} (${cuTask.name}): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (lastPage || tasks.length === 0) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return result;
}

/**
 * Outbound synchronization with loop prevention.
 * Syncs a single WorkLens task to ClickUp if configured.
 */
export async function syncTaskToClickUp(
  context: AuthContext,
  taskId: string,
  options: {
    client?: ClickUpClient;
    db?: ClickUpSyncDatabase;
  } = {}
): Promise<{ success: boolean; externalTaskId?: string; skipped?: boolean }> {
  const db = options.db ?? defaultClickUpDatabase;

  const integration = await db.findIntegration(context.companyId);
  if (!integration || !integration.encryptedCredentials) {
    return { success: false, skipped: true };
  }

  const config = (integration.config as Record<string, unknown>) ?? {};
  const syncDirection = (config.syncDirection as string) || "INBOUND";
  if (syncDirection === "INBOUND") {
    // Outbound sync is disabled by configuration
    return { success: false, skipped: true };
  }

  const task = await db.findTask(context.companyId, taskId);
  if (!task) {
    return { success: false, skipped: true };
  }

  const mapping = await db.findMappingByInternal(context.companyId, "Task", taskId);
  // Loop prevention: check if this task was updated via inbound sync very recently (< 5s ago)
  if (mapping?.metadata) {
    const meta = mapping.metadata as Record<string, unknown>;
    if (meta.direction === "INBOUND" && meta.lastSyncedAt) {
      const syncTime = new Date(meta.lastSyncedAt as string).getTime();
      if (Date.now() - syncTime < 5000) {
        // Skip outbound sync to prevent infinite loop
        return { success: true, skipped: true, externalTaskId: mapping.externalId };
      }
    }
  }

  const { apiToken } = decryptJson<{ apiToken: string }>(
    integration.encryptedCredentials
  );
  const client = options.client ?? new ClickUpClient({ apiToken });

  const listId = config.listId as string;
  const clickUpStatus = mapWorkLensStatusToClickUp(task.status);
  const dueDateMs = task.dueDate ? task.dueDate.getTime() : undefined;
  const timeEstimateMs = task.estimatedMinutes
    ? task.estimatedMinutes * 60000
    : undefined;

  if (mapping) {
    // Update existing ClickUp task
    await client.updateTask(mapping.externalId, {
      name: task.title,
      description: task.description || undefined,
      status: clickUpStatus,
      dueDate: dueDateMs,
      timeEstimate: timeEstimateMs,
    });

    await db.upsertMapping(
      context.companyId,
      "TASK",
      mapping.externalId,
      "Task",
      task.id,
      {
        lastSyncedAt: new Date().toISOString(),
        direction: "OUTBOUND",
      } as Prisma.InputJsonValue
    );

    return { success: true, externalTaskId: mapping.externalId };
  } else if (listId) {
    // Create new ClickUp task
    const created = await client.createTask(listId, {
      name: task.title,
      description: task.description || undefined,
      status: clickUpStatus,
      dueDate: dueDateMs,
      timeEstimate: timeEstimateMs,
    });

    await db.upsertMapping(
      context.companyId,
      "TASK",
      created.id,
      "Task",
      task.id,
      {
        lastSyncedAt: new Date().toISOString(),
        direction: "OUTBOUND",
      } as Prisma.InputJsonValue
    );

    return { success: true, externalTaskId: created.id };
  }

  return { success: false, skipped: true };
}
