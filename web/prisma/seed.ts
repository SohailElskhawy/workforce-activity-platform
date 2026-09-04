/**
 * Deterministic demo seed for WorkLens.
 *
 * Safe to re-run: deletes all data owned by the demo company (cascades from
 * Company) and recreates the same logical dataset. Dates are generated
 * relative to "now" so the demo always looks recent.
 *
 * Run: npx prisma db seed   (or: pnpm db:seed)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashAgentToken } from "../lib/agent/token";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const COMPANY_NAME = "WorkLens Demo Engineering";
const DEMO_PASSWORD = "Demo1234!";

/** Date `daysAgo` days in the past at the given local time. */
function at(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

async function main() {
  console.log(`Seeding demo data for "${COMPANY_NAME}"...`);

  // ---------------------------------------------------------------- cleanup
  // Every table cascades from Company, so removing the demo company removes
  // all demo-owned rows in foreign-key-safe order at the database level.
  const deleted = await prisma.company.deleteMany({
    where: { name: COMPANY_NAME },
  });
  if (deleted.count > 0) {
    console.log(`Removed ${deleted.count} previous demo company record(s).`);
  }

  // ---------------------------------------------------------------- company
  const company = await prisma.company.create({
    data: { name: COMPANY_NAME },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ------------------------------------------------------------- departments
  // Managers are created first (as employees) so departments can reference them.
  const managerDenizEmp = await prisma.employee.create({
    data: {
      companyId: company.id,
      firstName: "Deniz",
      lastName: "Sahin",
      email: "manager@worklens.demo",
      position: "Engineering Manager",
      status: "ACTIVE",
      hireDate: at(900, 9),
    },
  });
  const managerKeremEmp = await prisma.employee.create({
    data: {
      companyId: company.id,
      firstName: "Kerem",
      lastName: "Aydin",
      email: "manager2@worklens.demo",
      position: "Deputy Engineering Manager",
      status: "ACTIVE",
      hireDate: at(850, 9),
    },
  });

  const [deptElectrical, deptMechanical, deptCivil, deptPM] = await Promise.all(
    [
      prisma.department.create({
        data: {
          companyId: company.id,
          name: "Electrical Design",
          managerId: managerDenizEmp.id,
        },
      }),
      prisma.department.create({
        data: {
          companyId: company.id,
          name: "Mechanical Design",
          managerId: managerKeremEmp.id,
        },
      }),
      prisma.department.create({
        data: {
          companyId: company.id,
          name: "Civil Engineering",
          managerId: managerKeremEmp.id,
        },
      }),
      prisma.department.create({
        data: {
          companyId: company.id,
          name: "Project Management",
          managerId: managerDenizEmp.id,
        },
      }),
    ],
  );

  // ---------------------------------------------------------------- managers
  await Promise.all([
    prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: managerDenizEmp.id,
        email: "manager@worklens.demo",
        passwordHash,
        role: "MANAGER",
      },
    }),
    prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: managerKeremEmp.id,
        email: "manager2@worklens.demo",
        passwordHash,
        role: "MANAGER",
      },
    }),
  ]);

  const managerUser = await prisma.user.findUniqueOrThrow({
    where: { email: "manager@worklens.demo" },
  });

  // --------------------------------------------------------------- employees
  const employeeSeed = [
    {
      firstName: "Mehmet",
      lastName: "Yilmaz",
      email: "employee@worklens.demo",
      position: "Senior Electrical Engineer",
      departmentId: deptElectrical.id,
      managerId: managerDenizEmp.id,
    },
    {
      firstName: "Ayse",
      lastName: "Demir",
      email: "ayse.demir@worklens.demo",
      position: "Electrical Engineer",
      departmentId: deptElectrical.id,
      managerId: managerDenizEmp.id,
    },
    {
      firstName: "Can",
      lastName: "Ozkan",
      email: "can.ozkan@worklens.demo",
      position: "Mechanical Engineer",
      departmentId: deptMechanical.id,
      managerId: managerKeremEmp.id,
    },
    {
      firstName: "Elif",
      lastName: "Kaya",
      email: "elif.kaya@worklens.demo",
      position: "HVAC Designer",
      departmentId: deptMechanical.id,
      managerId: managerKeremEmp.id,
    },
    {
      firstName: "Burak",
      lastName: "Cetin",
      email: "burak.cetin@worklens.demo",
      position: "Structural Engineer",
      departmentId: deptCivil.id,
      managerId: managerKeremEmp.id,
    },
    {
      firstName: "Zeynep",
      lastName: "Arslan",
      email: "zeynep.arslan@worklens.demo",
      position: "Project Coordinator",
      departmentId: deptPM.id,
      managerId: managerDenizEmp.id,
    },
  ];

  const employees: Record<string, { id: string; email: string }> = {};
  for (const e of employeeSeed) {
    const emp = await prisma.employee.create({
      data: {
        companyId: company.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        position: e.position,
        departmentId: e.departmentId,
        managerId: e.managerId,
        status: "ACTIVE",
        hireDate: at(400, 9),
      },
    });
    await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: emp.id,
        email: e.email,
        passwordHash,
        role: "EMPLOYEE",
      },
    });
    employees[e.email] = { id: emp.id, email: e.email };
  }

  const mehmet = employees["employee@worklens.demo"];
  const ayse = employees["ayse.demir@worklens.demo"];
  const can = employees["can.ozkan@worklens.demo"];
  const elif = employees["elif.kaya@worklens.demo"];
  const burak = employees["burak.cetin@worklens.demo"];
  const zeynep = employees["zeynep.arslan@worklens.demo"];

  // ---------------------------------------------------------------- projects
  const projectABC = await prisma.project.create({
    data: {
      companyId: company.id,
      name: "ABC AVM Electrical Project",
      code: "ABC-ELE",
      description:
        "Full electrical design package for the ABC AVM shopping mall: power, lighting, low-voltage systems.",
      clientName: "ABC AVM",
      status: "ACTIVE",
      startDate: at(45, 9),
      endDate: at(-75, 18),
      estimatedHours: 1200,
      createdById: managerUser.id,
    },
  });
  const projectMP = await prisma.project.create({
    data: {
      companyId: company.id,
      name: "Metro Plaza HVAC Upgrade",
      code: "MP-HVAC",
      description:
        "HVAC system replacement and capacity upgrade for Metro Plaza office tower.",
      clientName: "Metro Plaza",
      status: "ACTIVE",
      startDate: at(30, 9),
      endDate: at(-60, 18),
      estimatedHours: 800,
      createdById: managerUser.id,
    },
  });
  const projectST = await prisma.project.create({
    data: {
      companyId: company.id,
      name: "Seaside Tower Structural Review",
      code: "ST-STR",
      description:
        "Independent structural review of the Seaside Tower residence project.",
      clientName: "Seaside Holdings",
      status: "PLANNED",
      startDate: at(-14, 9),
      endDate: at(-120, 18),
      estimatedHours: 400,
      createdById: managerUser.id,
    },
  });

  // ------------------------------------------------------------------- tasks
  type TaskSeed = {
    title: string;
    projectId: string;
    status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "REVIEW" | "COMPLETED";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueInDays: number;
    estimatedMinutes: number;
    description: string;
    completedDaysAgo?: number;
  };

  const taskSeeds: TaskSeed[] = [
    {
      title: "A Block Electrical Drawing",
      projectId: projectABC.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueInDays: 7,
      estimatedMinutes: 2400,
      description:
        "Complete electrical drawing set for A Block: power plans, riser diagram, panel schedules.",
    },
    {
      title: "B Block Electrical Drawing",
      projectId: projectABC.id,
      status: "TODO",
      priority: "MEDIUM",
      dueInDays: 14,
      estimatedMinutes: 2000,
      description:
        "Electrical drawing set for B Block, based on approved A Block template.",
    },
    {
      title: "Lighting Layout Revision",
      projectId: projectABC.id,
      status: "REVIEW",
      priority: "MEDIUM",
      dueInDays: 5,
      estimatedMinutes: 600,
      description:
        "Revise lighting layouts per client comments from the second design review.",
    },
    {
      title: "Panel Schedule Update",
      projectId: projectABC.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueInDays: 10,
      estimatedMinutes: 900,
      description: "Update panel schedules after load calculation changes.",
    },
    {
      title: "Cable Tray Routing Plan",
      projectId: projectABC.id,
      status: "TODO",
      priority: "LOW",
      dueInDays: 21,
      estimatedMinutes: 1200,
      description:
        "Route main cable trays through parking levels and coordinate with mechanical.",
    },
    {
      title: "Site Power Load Calculation",
      projectId: projectABC.id,
      status: "COMPLETED",
      priority: "MEDIUM",
      dueInDays: -3,
      estimatedMinutes: 480,
      description: "Total site demand calculation and transformer sizing.",
      completedDaysAgo: 3,
    },
    {
      title: "AHU Selection Review",
      projectId: projectMP.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueInDays: 6,
      estimatedMinutes: 720,
      description: "Review vendor proposals for rooftop AHU replacement.",
    },
    {
      title: "Ductwork Layout",
      projectId: projectMP.id,
      status: "TODO",
      priority: "MEDIUM",
      dueInDays: 18,
      estimatedMinutes: 1500,
      description:
        "Ductwork routing for floors 3-7 with new AHU configuration.",
    },
    {
      title: "Chiller Capacity Check",
      projectId: projectMP.id,
      status: "BLOCKED",
      priority: "URGENT",
      dueInDays: 3,
      estimatedMinutes: 360,
      description:
        "Blocked: waiting for as-built cooling load report from facility management.",
    },
    {
      title: "Ventilation Commissioning Plan",
      projectId: projectMP.id,
      status: "TODO",
      priority: "LOW",
      dueInDays: 30,
      estimatedMinutes: 480,
      description:
        "Commissioning sequence and test plan for ventilation systems.",
    },
    {
      title: "Structural Load Analysis",
      projectId: projectST.id,
      status: "TODO",
      priority: "MEDIUM",
      dueInDays: 25,
      estimatedMinutes: 1600,
      description:
        "Independent verification of vertical and lateral load paths.",
    },
    {
      title: "Foundation Drawing Set",
      projectId: projectST.id,
      status: "TODO",
      priority: "LOW",
      dueInDays: 40,
      estimatedMinutes: 1200,
      description: "Review and mark up foundation drawing set.",
    },
  ];

  const tasks: Record<string, { id: string; title: string }> = {};
  for (const t of taskSeeds) {
    const dueDate = at(-t.dueInDays, 18);
    const task = await prisma.task.create({
      data: {
        companyId: company.id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        createdById: managerUser.id,
        status: t.status,
        priority: t.priority,
        estimatedMinutes: t.estimatedMinutes,
        dueDate,
        completedAt: t.completedDaysAgo ? at(t.completedDaysAgo, 16, 30) : null,
      },
    });
    tasks[t.title] = { id: task.id, title: t.title };
  }

  const taskA = tasks["A Block Electrical Drawing"];
  const taskB = tasks["B Block Electrical Drawing"];
  const taskLighting = tasks["Lighting Layout Revision"];
  const taskPanel = tasks["Panel Schedule Update"];
  const taskTray = tasks["Cable Tray Routing Plan"];
  const taskAHU = tasks["AHU Selection Review"];
  const taskDuct = tasks["Ductwork Layout"];
  const taskChiller = tasks["Chiller Capacity Check"];
  const taskLoad = tasks["Structural Load Analysis"];
  const taskFoundation = tasks["Foundation Drawing Set"];

  // ------------------------------------------------------------- assignments
  const assignmentSeed: Array<{ taskId: string; employeeId: string }> = [
    { taskId: taskA.id, employeeId: mehmet.id },
    { taskId: taskLighting.id, employeeId: mehmet.id },
    { taskId: taskPanel.id, employeeId: mehmet.id },
    { taskId: taskB.id, employeeId: ayse.id },
    { taskId: taskTray.id, employeeId: ayse.id },
    { taskId: taskDuct.id, employeeId: can.id },
    { taskId: taskAHU.id, employeeId: elif.id },
    { taskId: taskChiller.id, employeeId: elif.id },
    { taskId: taskLoad.id, employeeId: burak.id },
    { taskId: taskFoundation.id, employeeId: burak.id },
    { taskId: taskPanel.id, employeeId: zeynep.id },
  ];

  for (const a of assignmentSeed) {
    await prisma.taskAssignment.create({
      data: {
        companyId: company.id,
        taskId: a.taskId,
        employeeId: a.employeeId,
        assignedById: managerUser.id,
        assignedAt: at(10, 10),
      },
    });
  }

  // ------------------------------------------------------------- time entries
  // 24 manual time entries: 6 employees x 4 entries over the last 8 days.
  const timeEntrySeed: Array<{
    employeeId: string;
    projectId: string;
    taskId: string | null;
    daysAgo: number;
    startHour: number;
    durationMinutes: number;
    notes: string;
  }> = [
    {
      employeeId: mehmet.id,
      projectId: projectABC.id,
      taskId: taskA.id,
      daysAgo: 8,
      startHour: 9,
      durationMinutes: 150,
      notes: "A Block power plan drafting",
    },
    {
      employeeId: mehmet.id,
      projectId: projectABC.id,
      taskId: taskA.id,
      daysAgo: 6,
      startHour: 13,
      durationMinutes: 120,
      notes: "Riser diagram updates",
    },
    {
      employeeId: mehmet.id,
      projectId: projectABC.id,
      taskId: taskLighting.id,
      daysAgo: 4,
      startHour: 10,
      durationMinutes: 90,
      notes: "Lighting revision per client comments",
    },
    {
      employeeId: mehmet.id,
      projectId: projectABC.id,
      taskId: taskPanel.id,
      daysAgo: 2,
      startHour: 14,
      durationMinutes: 180,
      notes: "Panel schedule recalculation",
    },
    {
      employeeId: ayse.id,
      projectId: projectABC.id,
      taskId: taskB.id,
      daysAgo: 7,
      startHour: 9,
      durationMinutes: 120,
      notes: "B Block template setup",
    },
    {
      employeeId: ayse.id,
      projectId: projectABC.id,
      taskId: taskB.id,
      daysAgo: 5,
      startHour: 11,
      durationMinutes: 150,
      notes: "B Block power plan drafting",
    },
    {
      employeeId: ayse.id,
      projectId: projectABC.id,
      taskId: taskTray.id,
      daysAgo: 3,
      startHour: 9,
      durationMinutes: 60,
      notes: "Cable tray routing study",
    },
    {
      employeeId: ayse.id,
      projectId: projectABC.id,
      taskId: taskTray.id,
      daysAgo: 1,
      startHour: 15,
      durationMinutes: 90,
      notes: "Parking level coordination",
    },
    {
      employeeId: can.id,
      projectId: projectMP.id,
      taskId: taskDuct.id,
      daysAgo: 8,
      startHour: 10,
      durationMinutes: 120,
      notes: "Ductwork layout floors 3-5",
    },
    {
      employeeId: can.id,
      projectId: projectMP.id,
      taskId: taskDuct.id,
      daysAgo: 6,
      startHour: 14,
      durationMinutes: 90,
      notes: "Ductwork layout floors 6-7",
    },
    {
      employeeId: can.id,
      projectId: projectMP.id,
      taskId: taskAHU.id,
      daysAgo: 4,
      startHour: 9,
      durationMinutes: 60,
      notes: "Vendor proposal comparison",
    },
    {
      employeeId: can.id,
      projectId: projectMP.id,
      taskId: taskDuct.id,
      daysAgo: 2,
      startHour: 13,
      durationMinutes: 150,
      notes: "Shaft coordination revisions",
    },
    {
      employeeId: elif.id,
      projectId: projectMP.id,
      taskId: taskAHU.id,
      daysAgo: 7,
      startHour: 9,
      durationMinutes: 180,
      notes: "AHU selection review meeting prep",
    },
    {
      employeeId: elif.id,
      projectId: projectMP.id,
      taskId: taskChiller.id,
      daysAgo: 5,
      startHour: 11,
      durationMinutes: 60,
      notes: "Chiller capacity preliminary check",
    },
    {
      employeeId: elif.id,
      projectId: projectMP.id,
      taskId: taskChiller.id,
      daysAgo: 3,
      startHour: 14,
      durationMinutes: 90,
      notes: "Waiting on as-built load report",
    },
    {
      employeeId: elif.id,
      projectId: projectMP.id,
      taskId: taskAHU.id,
      daysAgo: 1,
      startHour: 10,
      durationMinutes: 120,
      notes: "Selection review follow-ups",
    },
    {
      employeeId: burak.id,
      projectId: projectST.id,
      taskId: taskLoad.id,
      daysAgo: 8,
      startHour: 9,
      durationMinutes: 150,
      notes: "Load path model setup",
    },
    {
      employeeId: burak.id,
      projectId: projectST.id,
      taskId: taskLoad.id,
      daysAgo: 6,
      startHour: 13,
      durationMinutes: 120,
      notes: "Vertical load verification",
    },
    {
      employeeId: burak.id,
      projectId: projectST.id,
      taskId: taskFoundation.id,
      daysAgo: 4,
      startHour: 10,
      durationMinutes: 90,
      notes: "Foundation drawing markup",
    },
    {
      employeeId: burak.id,
      projectId: projectST.id,
      taskId: taskLoad.id,
      daysAgo: 2,
      startHour: 14,
      durationMinutes: 60,
      notes: "Lateral system spot checks",
    },
    {
      employeeId: zeynep.id,
      projectId: projectABC.id,
      taskId: taskPanel.id,
      daysAgo: 7,
      startHour: 9,
      durationMinutes: 60,
      notes: "Progress tracking update",
    },
    {
      employeeId: zeynep.id,
      projectId: projectMP.id,
      taskId: taskChiller.id,
      daysAgo: 5,
      startHour: 11,
      durationMinutes: 90,
      notes: "Blocked item follow-up with FM team",
    },
    {
      employeeId: zeynep.id,
      projectId: projectABC.id,
      taskId: taskLighting.id,
      daysAgo: 3,
      startHour: 13,
      durationMinutes: 60,
      notes: "Review coordination",
    },
    {
      employeeId: zeynep.id,
      projectId: projectST.id,
      taskId: taskLoad.id,
      daysAgo: 1,
      startHour: 15,
      durationMinutes: 120,
      notes: "Kickoff planning for structural review",
    },
  ];

  for (const t of timeEntrySeed) {
    const startAt = at(t.daysAgo, t.startHour);
    const endAt = new Date(startAt.getTime() + t.durationMinutes * 60_000);
    await prisma.timeEntry.create({
      data: {
        companyId: company.id,
        employeeId: t.employeeId,
        projectId: t.projectId,
        taskId: t.taskId,
        startAt,
        endAt,
        durationMinutes: t.durationMinutes,
        notes: t.notes,
      },
    });
  }

  // ----------------------------------------------------------------- devices
  const demoAgentTokenPepper =
    process.env.AGENT_TOKEN_PEPPER || "worklens-demo-agent-token-pepper";
  process.env.AGENT_TOKEN_PEPPER = demoAgentTokenPepper;

  const agentTokenHashMehmet = hashAgentToken("demo-agent-token-mehmet");
  const agentTokenHashAyse = hashAgentToken("demo-agent-token-ayse");


  const deviceMehmet = await prisma.device.create({
    data: {
      companyId: company.id,
      employeeId: mehmet.id,
      deviceId: "WS-IST-0141",
      name: "Mehmet Workstation",
      agentTokenHash: agentTokenHashMehmet,
      agentVersion: "1.0.0",
      lastSeenAt: at(0, 8, 45),
      isActive: true,
    },
  });
  const deviceAyse = await prisma.device.create({
    data: {
      companyId: company.id,
      employeeId: ayse.id,
      deviceId: "WS-IST-0157",
      name: "Ayse Workstation",
      agentTokenHash: agentTokenHashAyse,
      agentVersion: "1.0.0",
      lastSeenAt: at(1, 17, 30),
      isActive: true,
    },
  });

  // ------------------------------------------------------------ file mappings
  await Promise.all([
    prisma.fileMapping.create({
      data: {
        companyId: company.id,
        normalizedFileName: "abc_a_block.dwg",
        originalFileName: "ABC_A_Block.dwg",
        projectId: projectABC.id,
        taskId: taskA.id,
        createdById: managerUser.id,
      },
    }),
    prisma.fileMapping.create({
      data: {
        companyId: company.id,
        normalizedFileName: "abc_b_block.dwg",
        originalFileName: "ABC_B_Block.dwg",
        projectId: projectABC.id,
        taskId: taskB.id,
        createdById: managerUser.id,
      },
    }),
    prisma.fileMapping.create({
      data: {
        companyId: company.id,
        normalizedFileName: "mp_ductwork_rev2.dwg",
        originalFileName: "MP_Ductwork_Rev2.dwg",
        projectId: projectMP.id,
        taskId: taskDuct.id,
        createdById: managerUser.id,
      },
    }),
  ]);

  // --------------------------------------------------------------- activities
  // 120+ activity records across the last 10 weekdays for the two
  // device-owning employees. Fully deterministic (no randomness).
  const appProfiles = [
    { app: "AutoCAD", process: "acad.exe", ext: "dwg" },
    { app: "Dialux evo", process: "dialux.exe", ext: "dialux" },
    { app: "Microsoft Excel", process: "EXCEL.EXE", ext: "xlsx" },
    { app: "Revit", process: "Revit.exe", ext: "rvt" },
    { app: "Google Chrome", process: "chrome.exe", ext: "" },
    { app: "Microsoft Outlook", process: "OUTLOOK.EXE", ext: "" },
  ];

  let activityCount = 0;

  for (let daysAgo = 1; daysAgo <= 14; daysAgo++) {
    const day = at(daysAgo, 9);
    if (isWeekend(day)) continue;

    for (const person of [
      {
        employee: mehmet,
        device: deviceMehmet,
        project: projectABC,
        task: taskA,
        code: "ABC-ELE",
      },
      {
        employee: ayse,
        device: deviceAyse,
        project: projectABC,
        task: taskB,
        code: "ABC-ELE",
      },
    ]) {
      let seq = 0;
      const eventId = (suffix: string) =>
        `${person.device.deviceId}-${daysAgo}-${seq++}-${suffix}`;

      const add = async (data: {
        type:
          | "APPLICATION"
          | "IDLE"
          | "COMPUTER_LOCK"
          | "COMPUTER_UNLOCK"
          | "SYSTEM_START"
          | "SYSTEM_STOP";
        startHour: number;
        startMinute: number;
        durationSeconds: number;
        appIndex?: number;
      }) => {
        const startAt = at(daysAgo, data.startHour, data.startMinute);
        const endAt = new Date(startAt.getTime() + data.durationSeconds * 1000);
        const profile =
          data.appIndex !== undefined
            ? appProfiles[data.appIndex % appProfiles.length]
            : null;
        await prisma.activity.create({
          data: {
            eventId: eventId(data.type.toLowerCase()),
            companyId: company.id,
            employeeId: person.employee.id,
            deviceId: person.device.id,
            projectId: data.type === "APPLICATION" ? person.project.id : null,
            taskId: data.type === "APPLICATION" ? person.task.id : null,
            startAt,
            endAt,
            durationSeconds: data.durationSeconds,
            applicationName: profile?.app ?? null,
            processName: profile?.process ?? null,
            windowTitle: profile
              ? `${person.code} - ${person.task.title}${profile.ext ? "." + profile.ext : ""}`
              : null,
            fileName: profile?.ext
              ? `${person.code}_${person.task.title.replace(/\s+/g, "_")}.${profile.ext}`
              : null,
            type: data.type,
          },
        });
        activityCount++;
      };

      await add({
        type: "SYSTEM_START",
        startHour: 8,
        startMinute: 30,
        durationSeconds: 5,
      });
      await add({
        type: "COMPUTER_UNLOCK",
        startHour: 8,
        startMinute: 31,
        durationSeconds: 5,
      });
      await add({
        type: "APPLICATION",
        startHour: 9,
        startMinute: 0,
        durationSeconds: 5400,
        appIndex: daysAgo,
      });
      await add({
        type: "APPLICATION",
        startHour: 10,
        startMinute: 45,
        durationSeconds: 4500,
        appIndex: daysAgo + 1,
      });
      await add({
        type: "IDLE",
        startHour: 12,
        startMinute: 0,
        durationSeconds: 5400,
      });
      await add({
        type: "APPLICATION",
        startHour: 13,
        startMinute: 30,
        durationSeconds: 12600,
        appIndex: daysAgo + 2,
      });
      await add({
        type: "COMPUTER_LOCK",
        startHour: 17,
        startMinute: 5,
        durationSeconds: 5,
      });
      await add({
        type: "SYSTEM_STOP",
        startHour: 17,
        startMinute: 10,
        durationSeconds: 5,
      });
    }
  }

  // ------------------------------------------------------------------ summary
  console.log("Seed complete.");
  console.log(`  Company:     ${COMPANY_NAME}`);
  console.log(`  Departments: 4`);
  console.log(
    `  Managers:    2 (manager@worklens.demo, manager2@worklens.demo)`,
  );
  console.log(`  Employees:   6 (employee@worklens.demo -> Mehmet Yilmaz)`);
  console.log(`  Projects:    3 (primary: ABC AVM Electrical Project)`);
  console.log(
    `  Tasks:       ${taskSeeds.length} (primary: A Block Electrical Drawing)`,
  );
  console.log(`  Assignments: ${assignmentSeed.length}`);
  console.log(`  Time entries:${timeEntrySeed.length}`);
  console.log(`  Devices:     2`);
  console.log(`  File maps:   3 (primary: ABC_A_Block.dwg)`);
  console.log(`  Activities:  ${activityCount}`);
  console.log(`  Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
