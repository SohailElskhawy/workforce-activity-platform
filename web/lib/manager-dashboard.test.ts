import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ManagerDashboard } from "@/components/manager/manager-dashboard";

test("manager dashboard explains portfolio, priority work, and recent activity", () => {
  const markup = renderToStaticMarkup(
    createElement(ManagerDashboard, {
      metrics: {
        activeSeconds: 3_600,
        employeeCount: 8,
        idleSeconds: 900,
        onlineDeviceCount: 1,
        overdueTaskCount: 2,
        weekActiveSeconds: 72_000,
      },
      projects: [
        {
          id: "project-1",
          code: "ABC-ELE",
          name: "ABC AVM Electrical Project",
          clientName: "ABC Property Group",
          status: "ACTIVE",
          endDate: new Date("2026-10-15T00:00:00.000Z"),
          estimatedHours: 420,
          taskCount: 5,
        },
      ],
      tasks: [
        {
          id: "task-1",
          title: "A Block Electrical Drawing",
          status: "IN_PROGRESS",
          priority: "HIGH",
          dueDate: new Date("2026-09-10T00:00:00.000Z"),
          projectCode: "ABC-ELE",
          assignees: ["Mehmet Yilmaz"],
        },
      ],
      recentActivities: [
        {
          id: "activity-1",
          type: "APPLICATION",
          applicationName: "AutoCAD",
          fileName: "ABC_A_Block.dwg",
          durationSeconds: 1_800,
          startAt: new Date("2026-09-01T09:00:00.000Z"),
          employeeId: "employee-1",
          employeeName: "Mehmet Yilmaz",
          projectCode: "ABC-ELE",
          taskTitle: "A Block Electrical Drawing",
        },
      ],
    }),
  );

  assert.match(markup, /Team members/);
  assert.match(markup, /Active projects/);
  assert.match(markup, /Open tasks/);
  assert.match(markup, /7-day activity/);
  assert.match(markup, /Portfolio overview/);
  assert.match(markup, /Priority work/);
  assert.match(markup, /Recent activity/);
  assert.match(markup, /ABC AVM Electrical Project/);
  assert.match(markup, /A Block Electrical Drawing/);
  assert.match(markup, /Mehmet Yilmaz/);
  assert.match(markup, /AutoCAD/);
  assert.match(markup, /ABC_A_Block\.dwg/);
  assert.match(markup, /href="\/projects\/project-1"/);
  assert.match(markup, /href="\/employees\/employee-1"/);
});

