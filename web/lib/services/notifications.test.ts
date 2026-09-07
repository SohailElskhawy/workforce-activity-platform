import assert from "node:assert/strict";
import test from "node:test";

import type { TaskNotification } from "@/lib/services/notifications";

type MockTask = {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
  project: { id: string; code: string; name: string };
  assignments: Array<{ employee: { id: string; firstName: string; lastName: string } }>;
};

function deriveNotificationsFromTasks(
  tasks: MockTask[],
  now: Date,
  filterEmployeeId?: string,
): TaskNotification[] {
  const nowTime = now.getTime();
  const window24h = nowTime + 24 * 60 * 60 * 1000;

  const filtered = tasks.filter((t) => {
    if (t.status === "COMPLETED" || t.status === "CANCELLED") return false;
    if (!t.dueDate) return false;
    if (filterEmployeeId) {
      if (!t.assignments.some((a) => a.employee.id === filterEmployeeId)) {
        return false;
      }
    }
    const dueTime = t.dueDate.getTime();
    return dueTime <= window24h;
  });

  const notifications: TaskNotification[] = filtered.map((task) => {
    const dueTime = task.dueDate!.getTime();
    const isOverdue = dueTime < nowTime;
    const diffHours = Math.round((dueTime - nowTime) / (60 * 60 * 1000));

    return {
      id: isOverdue ? `overdue-${task.id}` : `approaching-${task.id}`,
      type: isOverdue ? "TASK_OVERDUE" : "TASK_DEADLINE_APPROACHING",
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.project.id,
      projectCode: task.project.code,
      projectName: task.project.name,
      dueDate: task.dueDate!.toISOString(),
      hoursDifference: Math.max(1, Math.abs(diffHours)),
      assignees: task.assignments.map((a) => ({
        id: a.employee.id,
        name: `${a.employee.firstName} ${a.employee.lastName}`,
      })),
      createdAt: task.dueDate!.toISOString(),
    };
  });

  return notifications.sort((a, b) => {
    if (a.type === "TASK_OVERDUE" && b.type !== "TASK_OVERDUE") return -1;
    if (a.type !== "TASK_OVERDUE" && b.type === "TASK_OVERDUE") return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

test("Notifications: detects approaching deadline and overdue tasks accurately", () => {
  const now = new Date("2026-09-07T12:00:00Z");

  const sampleTasks: MockTask[] = [
    {
      id: "task-overdue",
      title: "Fix foundation beam CAD",
      status: "IN_PROGRESS",
      dueDate: new Date("2026-09-07T08:00:00Z"), // 4h overdue
      project: { id: "p1", code: "PRJ-101", name: "Tower Alpha" },
      assignments: [
        { employee: { id: "emp-1", firstName: "Ali", lastName: "Yılmaz" } },
      ],
    },
    {
      id: "task-due-soon",
      title: "Review electrical wiring DWG",
      status: "TODO",
      dueDate: new Date("2026-09-07T18:00:00Z"), // due in 6h
      project: { id: "p1", code: "PRJ-101", name: "Tower Alpha" },
      assignments: [
        { employee: { id: "emp-1", firstName: "Ali", lastName: "Yılmaz" } },
      ],
    },
    {
      id: "task-completed",
      title: "Submit initial permit drawings",
      status: "COMPLETED",
      dueDate: new Date("2026-09-06T12:00:00Z"), // past, but completed
      project: { id: "p1", code: "PRJ-101", name: "Tower Alpha" },
      assignments: [
        { employee: { id: "emp-1", firstName: "Ali", lastName: "Yılmaz" } },
      ],
    },
    {
      id: "task-cancelled",
      title: "Obsolete facade redesign",
      status: "CANCELLED",
      dueDate: new Date("2026-09-07T06:00:00Z"), // past, but cancelled
      project: { id: "p1", code: "PRJ-101", name: "Tower Alpha" },
      assignments: [
        { employee: { id: "emp-1", firstName: "Ali", lastName: "Yılmaz" } },
      ],
    },
    {
      id: "task-far-future",
      title: "Phase 4 landscape CAD",
      status: "TODO",
      dueDate: new Date("2026-09-20T12:00:00Z"), // > 24h away
      project: { id: "p1", code: "PRJ-101", name: "Tower Alpha" },
      assignments: [
        { employee: { id: "emp-1", firstName: "Ali", lastName: "Yılmaz" } },
      ],
    },
    {
      id: "task-other-employee",
      title: "Plumbing schematics",
      status: "TODO",
      dueDate: new Date("2026-09-07T15:00:00Z"), // due in 3h
      project: { id: "p2", code: "PRJ-202", name: "Metro Station" },
      assignments: [
        { employee: { id: "emp-2", firstName: "Ayşe", lastName: "Demir" } },
      ],
    },
  ];

  // Manager sees both overdue and due-soon across company, excluding completed/cancelled/far-future
  const managerAlerts = deriveNotificationsFromTasks(sampleTasks, now);
  assert.equal(managerAlerts.length, 3);
  assert.equal(managerAlerts[0].type, "TASK_OVERDUE");
  assert.equal(managerAlerts[0].taskId, "task-overdue");
  assert.equal(managerAlerts[0].hoursDifference, 4);

  // Employee 1 sees only own tasks
  const emp1Alerts = deriveNotificationsFromTasks(sampleTasks, now, "emp-1");
  assert.equal(emp1Alerts.length, 2);
  assert.equal(emp1Alerts[0].taskId, "task-overdue");
  assert.equal(emp1Alerts[1].taskId, "task-due-soon");
  assert.equal(emp1Alerts[1].type, "TASK_DEADLINE_APPROACHING");

  // Employee 2 sees only task-other-employee
  const emp2Alerts = deriveNotificationsFromTasks(sampleTasks, now, "emp-2");
  assert.equal(emp2Alerts.length, 1);
  assert.equal(emp2Alerts[0].taskId, "task-other-employee");
});
