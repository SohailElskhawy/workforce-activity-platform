import type { AuthContext } from "@/lib/auth-context";
import { assertRole, tenantWhere } from "@/lib/auth-context";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import {
  ActivityType,
  AnomalyStatus,
  EmployeeStatus,
  ProjectStatus,
} from "@/src/generated/prisma/client";
import { getZonedDayBounds } from "@/lib/time/timezone";

// ==========================================
// 1. AUTOMATIC CLASSIFICATION DEFINITIONS
// ==========================================

export type ActivityCategory =
  | "ENGINEERING_CAD"
  | "OFFICE_DOCS"
  | "COMMUNICATION"
  | "DEV_TECHNICAL"
  | "BROWSING_RESEARCH"
  | "OTHER";

export const CATEGORY_LABELS: Record<
  ActivityCategory,
  { en: string; tr: string; color: string }
> = {
  ENGINEERING_CAD: {
    en: "Engineering & CAD",
    tr: "Mühendislik ve CAD",
    color: "#0284c7", // Sky 600
  },
  OFFICE_DOCS: {
    en: "Office & Documentation",
    tr: "Ofis ve Dokümantasyon",
    color: "#10b981", // Emerald 500
  },
  COMMUNICATION: {
    en: "Communication & Meetings",
    tr: "İletişim ve Toplantı",
    color: "#8b5cf6", // Violet 500
  },
  DEV_TECHNICAL: {
    en: "Technical & Tools",
    tr: "Teknik ve Araçlar",
    color: "#f59e0b", // Amber 500
  },
  BROWSING_RESEARCH: {
    en: "Web & Research",
    tr: "Web ve Araştırma",
    color: "#06b6d4", // Cyan 500
  },
  OTHER: {
    en: "Other Applications",
    tr: "Diğer Uygulamalar",
    color: "#6b7280", // Gray 500
  },
};

export function classifyProcessOrApplication(
  applicationName?: string | null,
  processName?: string | null,
): ActivityCategory {
  const app = (applicationName ?? "").toLowerCase().trim();
  const proc = (processName ?? "").toLowerCase().trim();

  // CAD & Engineering
  if (
    proc.includes("acad") ||
    proc.includes("autocad") ||
    proc.includes("revit") ||
    proc.includes("civil3d") ||
    proc.includes("navisworks") ||
    proc.includes("solidworks") ||
    proc.includes("microstation") ||
    proc.includes("sketchup") ||
    proc.includes("3dsmax") ||
    proc.includes("archicad") ||
    proc.includes("rhino") ||
    app.includes("autocad") ||
    app.includes("revit") ||
    app.includes("civil 3d") ||
    app.includes("navisworks") ||
    app.includes("solidworks") ||
    app.includes("dwg") ||
    app.includes("dxf") ||
    app.includes("sketchup") ||
    app.includes("archicad") ||
    app.includes("rhino")
  ) {
    return "ENGINEERING_CAD";
  }

  // Office & Documentation
  if (
    proc.includes("winword") ||
    proc.includes("excel") ||
    proc.includes("powerpnt") ||
    proc.includes("acrobat") ||
    proc.includes("acrord32") ||
    proc.includes("foxit") ||
    proc.includes("onenote") ||
    proc.includes("notepad") ||
    app.includes("word") ||
    app.includes("excel") ||
    app.includes("powerpoint") ||
    app.includes("acrobat") ||
    app.includes("pdf") ||
    app.includes("document") ||
    app.includes("spreadsheet") ||
    app.includes("onenote")
  ) {
    return "OFFICE_DOCS";
  }

  // Communication & Meetings
  if (
    proc.includes("teams") ||
    proc.includes("slack") ||
    proc.includes("outlook") ||
    proc.includes("zoom") ||
    proc.includes("discord") ||
    proc.includes("skype") ||
    proc.includes("thunderbird") ||
    app.includes("microsoft teams") ||
    app.includes("slack") ||
    app.includes("outlook") ||
    app.includes("zoom") ||
    app.includes("discord") ||
    app.includes("google meet") ||
    app.includes("webex")
  ) {
    return "COMMUNICATION";
  }

  // Development & Technical Tools
  if (
    proc.includes("code") ||
    proc.includes("devenv") ||
    proc.includes("windowsterminal") ||
    proc.includes("powershell") ||
    proc.includes("cmd") ||
    proc.includes("git") ||
    proc.includes("pycharm") ||
    proc.includes("idea64") ||
    app.includes("visual studio") ||
    app.includes("vs code") ||
    app.includes("terminal") ||
    app.includes("powershell") ||
    app.includes("git")
  ) {
    return "DEV_TECHNICAL";
  }

  // Web Browsing & Research
  if (
    proc.includes("chrome") ||
    proc.includes("msedge") ||
    proc.includes("firefox") ||
    proc.includes("brave") ||
    proc.includes("opera") ||
    app.includes("google chrome") ||
    app.includes("microsoft edge") ||
    app.includes("firefox") ||
    app.includes("browser")
  ) {
    return "BROWSING_RESEARCH";
  }

  return "OTHER";
}

// ==========================================
// 2. WORKLOAD & CAPACITY ANALYSIS
// ==========================================

export type EmployeeWorkloadStatus = "OVERUTILIZED" | "OPTIMAL" | "UNDERUTILIZED";

export type EmployeeWorkloadItem = {
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  position: string | null;
  activeSeconds: number;
  activeHours: number;
  expectedHours: number;
  capacityUtilizationPercent: number;
  status: EmployeeWorkloadStatus;
  openTasksCount: number;
  remainingEstimatedHours: number;
  activeProjects: Array<{ id: string; code: string; name: string }>;
};

export type WorkloadSummary = {
  periodDays: number;
  totalEmployees: number;
  overutilizedCount: number;
  optimalCount: number;
  underutilizedCount: number;
  averageCapacityUtilization: number;
  workloadImbalanceScore: number; // 0-100 score indicating standard deviation
  items: EmployeeWorkloadItem[];
};

export async function getWorkloadAnalysis(
  context: AuthContext,
  options: { periodDays?: number; departmentId?: string } = {},
  db: any = prisma,
): Promise<WorkloadSummary> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);
  const periodDays = Math.max(1, Math.min(60, options.periodDays ?? 7));

  const now = new Date();
  const startDate = new Date(now.getTime() - periodDays * 86_400_000);

  // Expected hours: standard 8h per working day (approx 5/7 of period days, min 1 day)
  const workingDays = Math.max(1, Math.round(periodDays * (5 / 7)));
  const expectedHoursPerEmployee = workingDays * 8;

  const employees = await db.employee.findMany({
    where: tenantWhere(context.companyId, {
      status: EmployeeStatus.ACTIVE,
      ...(options.departmentId ? { departmentId: options.departmentId } : {}),
    }),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
      assignments: {
        where: {
          task: {
            status: { in: ["TODO", "IN_PROGRESS"] },
          },
        },
        select: {
          task: {
            select: {
              id: true,
              title: true,
              estimatedMinutes: true,
              project: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const employeeIds = employees.map((e: any) => e.id);

  // Aggregate active seconds during period
  const activities = await db.activity.groupBy({
    by: ["employeeId"],
    where: tenantWhere(context.companyId, {
      employeeId: { in: employeeIds },
      type: ActivityType.APPLICATION,
      startAt: { gte: startDate },
    }),
    _sum: { durationSeconds: true },
  });

  const durationByEmp = new Map<string, number>();
  for (const act of activities) {
    durationByEmp.set(act.employeeId, act._sum?.durationSeconds ?? 0);
  }

  let overutilizedCount = 0;
  let optimalCount = 0;
  let underutilizedCount = 0;
  let totalUtilization = 0;

  const items: EmployeeWorkloadItem[] = employees.map((emp: any) => {
    const activeSec = durationByEmp.get(emp.id) ?? 0;
    const activeHours = Math.round((activeSec / 3600) * 10) / 10;
    const utilization = Math.round((activeHours / expectedHoursPerEmployee) * 100);

    let status: EmployeeWorkloadStatus = "OPTIMAL";
    if (utilization > 115) {
      status = "OVERUTILIZED";
      overutilizedCount++;
    } else if (utilization < 65) {
      status = "UNDERUTILIZED";
      underutilizedCount++;
    } else {
      optimalCount++;
    }

    totalUtilization += utilization;

    // Remaining estimated hours from open tasks
    const remainingEstMinutes = emp.assignments.reduce(
      (sum: number, a: any) => sum + (a.task?.estimatedMinutes ?? 0),
      0,
    );
    const remainingEstimatedHours = Math.round((remainingEstMinutes / 60) * 10) / 10;

    // Distinct active projects
    const projectMap = new Map<string, { id: string; code: string; name: string }>();
    for (const a of emp.assignments) {
      if (a.task.project) {
        projectMap.set(a.task.project.id, a.task.project);
      }
    }

    return {
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      departmentId: emp.departmentId,
      departmentName: emp.department?.name ?? null,
      position: emp.position,
      activeSeconds: activeSec,
      activeHours,
      expectedHours: expectedHoursPerEmployee,
      capacityUtilizationPercent: utilization,
      status,
      openTasksCount: emp.assignments.length,
      remainingEstimatedHours,
      activeProjects: Array.from(projectMap.values()),
    };
  });

  const count = items.length || 1;
  const avgUtilization = Math.round(totalUtilization / count);

  // Standard deviation for imbalance score
  const variance =
    items.reduce(
      (sum, item) =>
        sum + Math.pow(item.capacityUtilizationPercent - avgUtilization, 2),
      0,
    ) / count;
  const stdDev = Math.round(Math.sqrt(variance));
  const workloadImbalanceScore = Math.min(100, Math.round(stdDev * 1.5));

  return {
    periodDays,
    totalEmployees: items.length,
    overutilizedCount,
    optimalCount,
    underutilizedCount,
    averageCapacityUtilization: avgUtilization,
    workloadImbalanceScore,
    items,
  };
}

// ==========================================
// 3. PROJECT & TASK PREDICTIONS (ESTIMATED VS ACTUAL)
// ==========================================

export type OverrunRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProjectPredictionItem = {
  projectId: string;
  projectCode: string;
  projectName: string;
  status: string;
  estimatedHours: number;
  trackedHours: number;
  manualHours: number;
  differenceHours: number;
  completionPercent: number; // based on completed tasks
  totalTasksCount: number;
  completedTasksCount: number;
  openTasksCount: number;
  projectedHoursAtCompletion: number;
  varianceHours: number; // tracked - estimated
  isOverrun: boolean;
  overrunRisk: OverrunRiskLevel;
  burnRateHoursPerDay: number;
  topContributor: { employeeId: string; name: string; hours: number } | null;
  topTask: { taskId: string; title: string; hours: number } | null;
  mainCategory: ActivityCategory;
};

export type PredictionSummary = {
  totalProjects: number;
  overrunCount: number;
  atRiskCount: number;
  onTrackCount: number;
  totalEstimatedHours: number;
  totalTrackedHours: number;
  projects: ProjectPredictionItem[];
};

export async function getProjectPredictions(
  context: AuthContext,
  options: { projectId?: string } = {},
  db: any = prisma,
): Promise<PredictionSummary> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const projects = await db.project.findMany({
    where: tenantWhere(context.companyId, {
      status: {
        in: [
          ProjectStatus.PLANNED,
          ProjectStatus.ACTIVE,
          ProjectStatus.ON_HOLD,
        ],
      },
      ...(options.projectId ? { id: options.projectId } : {}),
    }),
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      estimatedHours: true,
      startDate: true,
      endDate: true,
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          estimatedMinutes: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!projects.length) {
    return {
      totalProjects: 0,
      overrunCount: 0,
      atRiskCount: 0,
      onTrackCount: 0,
      totalEstimatedHours: 0,
      totalTrackedHours: 0,
      projects: [],
    };
  }

  const projectIds = projects.map((p: any) => p.id);

  // Aggregate tracked activity by project
  const [activitySums, manualSums, activitiesForDetails] = await Promise.all([
    db.activity.groupBy({
      by: ["projectId"],
      where: tenantWhere(context.companyId, {
        projectId: { in: projectIds },
        type: ActivityType.APPLICATION,
      }),
      _sum: { durationSeconds: true },
    }),
    db.timeEntry.groupBy({
      by: ["projectId"],
      where: tenantWhere(context.companyId, {
        projectId: { in: projectIds },
      }),
      _sum: { durationMinutes: true },
    }),
    db.activity.findMany({
      where: tenantWhere(context.companyId, {
        projectId: { in: projectIds },
        type: ActivityType.APPLICATION,
      }),
      select: {
        projectId: true,
        employeeId: true,
        taskId: true,
        durationSeconds: true,
        applicationName: true,
        processName: true,
        employee: { select: { firstName: true, lastName: true } },
        task: { select: { id: true, title: true } },
      },
    }),
  ]);

  const trackedMap = new Map<string, number>();
  for (const a of activitySums) {
    if (a.projectId) trackedMap.set(a.projectId, a._sum?.durationSeconds ?? 0);
  }

  const manualMap = new Map<string, number>();
  for (const m of manualSums) {
    if (m.projectId) manualMap.set(m.projectId, m._sum?.durationMinutes ?? 0);
  }

  // Detailed breakdowns per project (employee, task, category)
  const projectDetailsMap = new Map<
    string,
    {
      empHours: Map<string, { name: string; seconds: number }>;
      taskHours: Map<string, { title: string; seconds: number }>;
      categorySeconds: Map<ActivityCategory, number>;
    }
  >();

  for (const row of activitiesForDetails) {
    if (!row.projectId) continue;
    let entry = projectDetailsMap.get(row.projectId);
    if (!entry) {
      entry = {
        empHours: new Map(),
        taskHours: new Map(),
        categorySeconds: new Map(),
      };
      projectDetailsMap.set(row.projectId, entry);
    }

    // Emp breakdown
    const empName = `${row.employee.firstName} ${row.employee.lastName}`.trim();
    const curEmp = entry.empHours.get(row.employeeId) ?? { name: empName, seconds: 0 };
    curEmp.seconds += row.durationSeconds;
    entry.empHours.set(row.employeeId, curEmp);

    // Task breakdown
    if (row.taskId && row.task) {
      const curTask = entry.taskHours.get(row.taskId) ?? {
        title: row.task.title,
        seconds: 0,
      };
      curTask.seconds += row.durationSeconds;
      entry.taskHours.set(row.taskId, curTask);
    }

    // Category breakdown
    const cat = classifyProcessOrApplication(row.applicationName, row.processName);
    entry.categorySeconds.set(
      cat,
      (entry.categorySeconds.get(cat) ?? 0) + row.durationSeconds,
    );
  }

  let overrunCount = 0;
  let atRiskCount = 0;
  let onTrackCount = 0;
  let totalEst = 0;
  let totalTracked = 0;

  const items: ProjectPredictionItem[] = projects.map((p: any) => {
    const trackedSec = trackedMap.get(p.id) ?? 0;
    const trackedHours = Math.round((trackedSec / 3600) * 10) / 10;
    const manualMins = manualMap.get(p.id) ?? 0;
    const manualHours = Math.round((manualMins / 60) * 10) / 10;
    const estHours = p.estimatedHours ?? 0;

    totalEst += estHours;
    totalTracked += trackedHours;

    const totalTasks = p.tasks.length;
    const completedTasks = p.tasks.filter((t: any) => t.status === "COMPLETED").length;
    const openTasks = totalTasks - completedTasks;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Projected hours at completion based on current pace
    let projectedHours = trackedHours;
    if (completionPercent > 5 && completionPercent < 100) {
      projectedHours = Math.round((trackedHours / (completionPercent / 100)) * 10) / 10;
    } else if (completionPercent === 0 && estHours > 0) {
      projectedHours = Math.max(estHours, trackedHours);
    }

    const varianceHours = Math.round((trackedHours - estHours) * 10) / 10;
    const isOverrun = estHours > 0 && trackedHours > estHours;

    // Risk level determination
    let overrunRisk: OverrunRiskLevel = "LOW";
    if (isOverrun) {
      overrunRisk = "CRITICAL";
      overrunCount++;
    } else if (estHours > 0 && trackedHours >= estHours * 0.85) {
      overrunRisk = "HIGH";
      atRiskCount++;
    } else if (estHours > 0 && projectedHours > estHours * 1.1) {
      overrunRisk = "MEDIUM";
      atRiskCount++;
    } else {
      onTrackCount++;
    }

    // Top contributor
    const details = projectDetailsMap.get(p.id);
    let topContributor: { employeeId: string; name: string; hours: number } | null = null;
    if (details && details.empHours.size > 0) {
      let maxSec = -1;
      for (const [eId, eData] of details.empHours.entries()) {
        if (eData.seconds > maxSec) {
          maxSec = eData.seconds;
          topContributor = {
            employeeId: eId,
            name: eData.name,
            hours: Math.round((eData.seconds / 3600) * 10) / 10,
          };
        }
      }
    }

    // Top task
    let topTask: { taskId: string; title: string; hours: number } | null = null;
    if (details && details.taskHours.size > 0) {
      let maxSec = -1;
      for (const [tId, tData] of details.taskHours.entries()) {
        if (tData.seconds > maxSec) {
          maxSec = tData.seconds;
          topTask = {
            taskId: tId,
            title: tData.title,
            hours: Math.round((tData.seconds / 3600) * 10) / 10,
          };
        }
      }
    }

    // Main category
    let mainCategory: ActivityCategory = "OTHER";
    if (details && details.categorySeconds.size > 0) {
      let maxSec = -1;
      for (const [cat, sec] of details.categorySeconds.entries()) {
        if (sec > maxSec) {
          maxSec = sec;
          mainCategory = cat;
        }
      }
    }

    // Burn rate
    const burnRateHoursPerDay = Math.round((trackedHours / Math.max(1, totalTasks * 2)) * 10) / 10;

    return {
      projectId: p.id,
      projectCode: p.code,
      projectName: p.name,
      status: p.status,
      estimatedHours: estHours,
      trackedHours,
      manualHours,
      differenceHours: Math.round((manualHours - trackedHours) * 10) / 10,
      completionPercent,
      totalTasksCount: totalTasks,
      completedTasksCount: completedTasks,
      openTasksCount: openTasks,
      projectedHoursAtCompletion: projectedHours,
      varianceHours,
      isOverrun,
      overrunRisk,
      burnRateHoursPerDay,
      topContributor,
      topTask,
      mainCategory,
    };
  });

  return {
    totalProjects: items.length,
    overrunCount,
    atRiskCount,
    onTrackCount,
    totalEstimatedHours: Math.round(totalEst * 10) / 10,
    totalTrackedHours: Math.round(totalTracked * 10) / 10,
    projects: items,
  };
}

// ==========================================
// 4. AUTOMATIC CLASSIFICATION BREAKDOWN
// ==========================================

export type CategoryBreakdownItem = {
  category: ActivityCategory;
  durationSeconds: number;
  durationHours: number;
  percentage: number;
  topApplications: Array<{ name: string; durationHours: number }>;
};

export type ClassificationSummary = {
  totalSeconds: number;
  totalHours: number;
  categories: CategoryBreakdownItem[];
  departmentBreakdown?: Array<{
    departmentName: string;
    categories: Record<ActivityCategory, number>;
  }>;
};

export async function getAutomaticClassification(
  context: AuthContext,
  options: {
    periodDays?: number;
    employeeId?: string;
    projectId?: string;
  } = {},
  db: any = prisma,
): Promise<ClassificationSummary> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const periodDays = Math.max(1, Math.min(60, options.periodDays ?? 7));
  const startDate = new Date(Date.now() - periodDays * 86_400_000);

  const activities = await db.activity.findMany({
    where: tenantWhere(context.companyId, {
      type: ActivityType.APPLICATION,
      startAt: { gte: startDate },
      ...(options.employeeId ? { employeeId: options.employeeId } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
    }),
    select: {
      durationSeconds: true,
      applicationName: true,
      processName: true,
      employee: {
        select: {
          department: { select: { name: true } },
        },
      },
    },
  });

  const categorySums = new Map<ActivityCategory, number>();
  const categoryApps = new Map<ActivityCategory, Map<string, number>>();
  const deptMap = new Map<string, Record<ActivityCategory, number>>();

  let totalSeconds = 0;

  for (const act of activities) {
    const cat = classifyProcessOrApplication(act.applicationName, act.processName);
    totalSeconds += act.durationSeconds;
    categorySums.set(cat, (categorySums.get(cat) ?? 0) + act.durationSeconds);

    // App breakdown within category
    const appName = act.applicationName?.trim() || act.processName?.trim() || "Unknown";
    let appMap = categoryApps.get(cat);
    if (!appMap) {
      appMap = new Map();
      categoryApps.set(cat, appMap);
    }
    appMap.set(appName, (appMap.get(appName) ?? 0) + act.durationSeconds);

    // Dept breakdown
    const deptName = act.employee?.department?.name ?? "General";
    let deptEntry = deptMap.get(deptName);
    if (!deptEntry) {
      deptEntry = {
        ENGINEERING_CAD: 0,
        OFFICE_DOCS: 0,
        COMMUNICATION: 0,
        DEV_TECHNICAL: 0,
        BROWSING_RESEARCH: 0,
        OTHER: 0,
      };
      deptMap.set(deptName, deptEntry);
    }
    deptEntry[cat] += act.durationSeconds;
  }

  const allCategories: ActivityCategory[] = [
    "ENGINEERING_CAD",
    "OFFICE_DOCS",
    "COMMUNICATION",
    "DEV_TECHNICAL",
    "BROWSING_RESEARCH",
    "OTHER",
  ];

  const categories: CategoryBreakdownItem[] = allCategories.map((cat) => {
    const durSec = categorySums.get(cat) ?? 0;
    const durHours = Math.round((durSec / 3600) * 10) / 10;
    const percentage =
      totalSeconds > 0 ? Math.round((durSec / totalSeconds) * 1000) / 10 : 0;

    const appMap = categoryApps.get(cat) ?? new Map();
    const topApplications = Array.from(appMap.entries())
      .map(([name, sec]) => ({
        name,
        durationHours: Math.round((sec / 3600) * 10) / 10,
      }))
      .sort((a, b) => b.durationHours - a.durationHours)
      .slice(0, 5);

    return {
      category: cat,
      durationSeconds: durSec,
      durationHours: durHours,
      percentage,
      topApplications,
    };
  });

  const departmentBreakdown = Array.from(deptMap.entries()).map(
    ([deptName, catMap]) => ({
      departmentName: deptName,
      categories: {
        ENGINEERING_CAD: Math.round(((catMap.ENGINEERING_CAD ?? 0) / 3600) * 10) / 10,
        OFFICE_DOCS: Math.round(((catMap.OFFICE_DOCS ?? 0) / 3600) * 10) / 10,
        COMMUNICATION: Math.round(((catMap.COMMUNICATION ?? 0) / 3600) * 10) / 10,
        DEV_TECHNICAL: Math.round(((catMap.DEV_TECHNICAL ?? 0) / 3600) * 10) / 10,
        BROWSING_RESEARCH: Math.round(((catMap.BROWSING_RESEARCH ?? 0) / 3600) * 10) / 10,
        OTHER: Math.round(((catMap.OTHER ?? 0) / 3600) * 10) / 10,
      },
    }),
  );

  return {
    totalSeconds,
    totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
    categories,
    departmentBreakdown,
  };
}

// ==========================================
// 5. MANAGEMENT RECOMMENDATIONS ENGINE
// ==========================================

export type RecommendationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type ManagementRecommendation = {
  id: string;
  category: "WORKLOAD" | "PROJECT_RISK" | "DWG_MATCHING" | "ANOMALY_REVIEW";
  severity: RecommendationSeverity;
  title: string;
  description: string;
  actionText: string;
  actionHref: string;
  targetId?: string;
};

export async function getManagementRecommendations(
  context: AuthContext,
  db: any = prisma,
): Promise<ManagementRecommendation[]> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const [workload, predictions, unmappedDwgs, openAnomalies] = await Promise.all([
    getWorkloadAnalysis(context, { periodDays: 7 }, db),
    getProjectPredictions(context, {}, db),
    db.activity.aggregate({
      where: tenantWhere(context.companyId, {
        type: ActivityType.APPLICATION,
        fileName: { not: null },
        projectId: null,
      }),
      _sum: { durationSeconds: true },
      _count: { id: true },
    }),
    db.anomaly.findMany({
      where: tenantWhere(context.companyId, {
        status: AnomalyStatus.OPEN,
      }),
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
      },
      take: 5,
    }),
  ]);

  const recommendations: ManagementRecommendation[] = [];

  // Rule 1: Overloaded vs Underutilized Workload Imbalance
  const overloaded = workload.items.filter((i) => i.status === "OVERUTILIZED");
  const underutilized = workload.items.filter((i) => i.status === "UNDERUTILIZED");

  if (overloaded.length > 0 && underutilized.length > 0) {
    const topOver = overloaded[0];
    const topUnder = underutilized[0];
    recommendations.push({
      id: `rec-workload-${topOver.employeeId}-${topUnder.employeeId}`,
      category: "WORKLOAD",
      severity: "WARNING",
      title: "Workload Imbalance Detected",
      description: `${topOver.employeeName} is at ${topOver.capacityUtilizationPercent}% capacity (${topOver.activeHours}h active, ${topOver.openTasksCount} open tasks), while ${topUnder.employeeName} is at ${topUnder.capacityUtilizationPercent}%. Consider rebalancing upcoming task assignments.`,
      actionText: "View Tasks",
      actionHref: "/tasks",
      targetId: topOver.employeeId,
    });
  } else if (overloaded.length > 0) {
    const topOver = overloaded[0];
    recommendations.push({
      id: `rec-workload-high-${topOver.employeeId}`,
      category: "WORKLOAD",
      severity: "WARNING",
      title: "High Workload Alert",
      description: `${topOver.employeeName} has logged ${topOver.activeHours}h in the past 7 days (${topOver.capacityUtilizationPercent}% utilization) across ${topOver.activeProjects.length} projects. Monitor for burnout risk.`,
      actionText: "View Employee",
      actionHref: `/employees/${topOver.employeeId}`,
      targetId: topOver.employeeId,
    });
  }

  // Rule 2: Project Overrun Warnings
  const overrunProjects = predictions.projects.filter(
    (p) => p.isOverrun || p.overrunRisk === "HIGH" || p.overrunRisk === "CRITICAL",
  );

  for (const p of overrunProjects.slice(0, 2)) {
    if (p.isOverrun) {
      recommendations.push({
        id: `rec-proj-overrun-${p.projectId}`,
        category: "PROJECT_RISK",
        severity: "CRITICAL",
        title: `Project Budget Overrun: ${p.projectName}`,
        description: `Project has tracked ${p.trackedHours}h, exceeding the planned estimate of ${p.estimatedHours}h by +${p.varianceHours}h. Main contributor: ${p.topTask?.title ?? "General Work"} (${p.topTask?.hours ?? 0}h).`,
        actionText: "Inspect Project",
        actionHref: `/projects/${p.projectId}`,
        targetId: p.projectId,
      });
    } else {
      recommendations.push({
        id: `rec-proj-risk-${p.projectId}`,
        category: "PROJECT_RISK",
        severity: "WARNING",
        title: `Project Near Estimate: ${p.projectName}`,
        description: `Project has reached ${p.trackedHours}h (${Math.round((p.trackedHours / p.estimatedHours) * 100)}% of ${p.estimatedHours}h estimate) with ${p.openTasksCount} tasks remaining. Projected at completion: ${p.projectedHoursAtCompletion}h.`,
        actionText: "Inspect Project",
        actionHref: `/projects/${p.projectId}`,
        targetId: p.projectId,
      });
    }
  }

  // Rule 3: Unmapped DWG File Activity
  const unmappedHours = Math.round(((unmappedDwgs._sum?.durationSeconds ?? 0) / 3600) * 10) / 10;
  if (unmappedHours >= 2) {
    recommendations.push({
      id: "rec-dwg-unmapped",
      category: "DWG_MATCHING",
      severity: "INFO",
      title: "Unallocated AutoCAD / DWG Time",
      description: `${unmappedHours} hours of CAD activity on unmapped DWG files has not yet been assigned to any project. Review suggested auto-matches to ensure accurate project tracking.`,
      actionText: "Review DWG Matches",
      actionHref: "/reports?tab=autocad",
    });
  }

  // Rule 4: Unreviewed Anomalies
  if (openAnomalies.length > 0) {
    const highCount = openAnomalies.filter((a: any) => a.severity === "HIGH").length;
    recommendations.push({
      id: "rec-anomalies-open",
      category: "ANOMALY_REVIEW",
      severity: highCount > 0 ? "WARNING" : "INFO",
      title: "Anomalies Requiring Review",
      description: `There are ${openAnomalies.length} open activity anomalies (${highCount} high severity) awaiting managerial review.`,
      actionText: "Review Anomalies",
      actionHref: "/anomalies",
    });
  }

  return recommendations;
}

// ==========================================
// 6. AI EXECUTIVE BRIEFING COMPILER
// ==========================================

export type ExecutiveBriefing = {
  generatedAt: string;
  periodLabel: string;
  range: "today" | "week" | "month";
  executiveSummary: string;
  metrics: {
    activeEmployees: number;
    totalActiveHours: number;
    totalIdleHours: number;
    cadTimeHours: number;
    officeTimeHours: number;
    commTimeHours: number;
    topProjectName: string | null;
    topProjectHours: number;
  };
  keyFindings: string[];
  recommendations: ManagementRecommendation[];
  projectHighlights: Array<{
    code: string;
    name: string;
    trackedHours: number;
    estimatedHours: number;
    status: string;
    risk: OverrunRiskLevel;
  }>;
};

export async function generateExecutiveBriefing(
  context: AuthContext,
  range: "today" | "week" | "month" = "week",
  db: any = prisma,
): Promise<ExecutiveBriefing> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const periodDays = range === "today" ? 1 : range === "month" ? 30 : 7;
  const periodLabel =
    range === "today"
      ? "Today"
      : range === "month"
        ? "Last 30 Days"
        : "Last 7 Days";

  const [workload, predictions, classification, recommendations] = await Promise.all([
    getWorkloadAnalysis(context, { periodDays }, db),
    getProjectPredictions(context, {}, db),
    getAutomaticClassification(context, { periodDays }, db),
    getManagementRecommendations(context, db),
  ]);

  // Aggregate idle time
  const startDate = new Date(Date.now() - periodDays * 86_400_000);
  const idleSum = await db.activity.aggregate({
    where: tenantWhere(context.companyId, {
      type: ActivityType.IDLE,
      startAt: { gte: startDate },
    }),
    _sum: { durationSeconds: true },
  });
  const idleHours = Math.round(((idleSum._sum?.durationSeconds ?? 0) / 3600) * 10) / 10;

  const cadCategory = classification.categories.find((c) => c.category === "ENGINEERING_CAD");
  const officeCategory = classification.categories.find((c) => c.category === "OFFICE_DOCS");
  const commCategory = classification.categories.find((c) => c.category === "COMMUNICATION");

  const topProject = predictions.projects.sort((a, b) => b.trackedHours - a.trackedHours)[0] ?? null;

  // Formulate key findings deterministically based on facts
  const keyFindings: string[] = [];

  keyFindings.push(
    `Workforce logged ${classification.totalHours} active hours across ${workload.totalEmployees} team members with ${idleHours}h idle time.`,
  );

  if (topProject) {
    keyFindings.push(
      `Top active project was ${topProject.projectName} (${topProject.projectCode}) with ${topProject.trackedHours}h tracked (${topProject.isOverrun ? "EXCEEDING ESTIMATE" : `${topProject.completionPercent}% complete`}).`,
    );
  }

  if (cadCategory && cadCategory.durationHours > 0) {
    keyFindings.push(
      `Engineering & CAD software accounted for ${cadCategory.percentage}% of all workforce active time (${cadCategory.durationHours}h).`,
    );
  }

  if (predictions.overrunCount > 0) {
    keyFindings.push(
      `${predictions.overrunCount} project(s) have exceeded their estimated time allocations and require management review.`,
    );
  } else if (predictions.atRiskCount > 0) {
    keyFindings.push(
      `${predictions.atRiskCount} project(s) are approaching their estimated budgets (>85% consumed).`,
    );
  } else {
    keyFindings.push("All monitored projects are currently tracking within their planned time budgets.");
  }

  if (workload.overutilizedCount > 0) {
    keyFindings.push(
      `${workload.overutilizedCount} employee(s) logged excessive workload (>115% capacity utilization).`,
    );
  }

  // Executive narrative synthesis
  const executiveSummary = [
    `During the ${periodLabel.toLowerCase()}, the organization recorded ${classification.totalHours} hours of productive activity.`,
    `Engineering and design software represented the primary focus (${cadCategory?.durationHours ?? 0}h, ${cadCategory?.percentage ?? 0}%), supported by ${officeCategory?.durationHours ?? 0}h of documentation and ${commCategory?.durationHours ?? 0}h of communications.`,
    predictions.overrunCount > 0
      ? `Attention is advised on ${predictions.overrunCount} project budget overrun(s).`
      : `Project delivery metrics remain within expected tolerance levels across ${predictions.totalProjects} active projects.`,
    workload.overutilizedCount > 0
      ? `Workload distribution shows ${workload.overutilizedCount} overloaded team member(s), with a team imbalance rating of ${workload.workloadImbalanceScore}/100.`
      : "Workload distribution remains well-balanced across the team.",
  ].join(" ");

  const projectHighlights = predictions.projects.slice(0, 5).map((p) => ({
    code: p.projectCode,
    name: p.projectName,
    trackedHours: p.trackedHours,
    estimatedHours: p.estimatedHours,
    status: p.status,
    risk: p.overrunRisk,
  }));

  return {
    generatedAt: new Date().toISOString(),
    periodLabel,
    range,
    executiveSummary,
    metrics: {
      activeEmployees: workload.totalEmployees,
      totalActiveHours: classification.totalHours,
      totalIdleHours: idleHours,
      cadTimeHours: cadCategory?.durationHours ?? 0,
      officeTimeHours: officeCategory?.durationHours ?? 0,
      commTimeHours: commCategory?.durationHours ?? 0,
      topProjectName: topProject?.projectName ?? null,
      topProjectHours: topProject?.trackedHours ?? 0,
    },
    keyFindings,
    recommendations,
    projectHighlights,
  };
}

// ==========================================
// 7. MANAGEMENT Q&A QUERY ENGINE
// ==========================================

export type QueryAnswer = {
  question: string;
  headline: string;
  details: string[];
  facts: Record<string, string | number>;
};

export async function askManagementIntelligence(
  context: AuthContext,
  question: string,
  db: any = prisma,
): Promise<QueryAnswer> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);
  const q = question.toLowerCase().trim();

  // Question 1: Overrun projects / exceeding time
  if (
    q.includes("planlanan") ||
    q.includes("üzerinde") ||
    q.includes("aş") ||
    q.includes("overrun") ||
    q.includes("exceed") ||
    q.includes("estimate") ||
    q.includes("bütçe")
  ) {
    const predictions = await getProjectPredictions(context, {}, db);
    const overruns = predictions.projects.filter((p) => p.isOverrun);
    const atRisk = predictions.projects.filter((p) => p.overrunRisk === "HIGH");

    if (overruns.length > 0) {
      const top = overruns[0];
      return {
        question,
        headline: `${overruns.length} project(s) are currently exceeding their planned estimates.`,
        details: [
          `Project ${top.projectName} (${top.projectCode}) has tracked ${top.trackedHours}h, exceeding the planned ${top.estimatedHours}h.`,
          `Main contributing task: ${top.topTask?.title ?? "General"} (${top.topTask?.hours ?? 0}h).`,
          `Most active contributor: ${top.topContributor?.name ?? "Team"} (${top.topContributor?.hours ?? 0}h).`,
          `Primary application: ${CATEGORY_LABELS[top.mainCategory].en}.`,
        ],
        facts: {
          overrunCount: overruns.length,
          topProject: top.projectName,
          trackedHours: top.trackedHours,
          estimatedHours: top.estimatedHours,
          varianceHours: top.varianceHours,
        },
      };
    }

    if (atRisk.length > 0) {
      const top = atRisk[0];
      return {
        question,
        headline: `No projects are in full overrun, but ${atRisk.length} project(s) are near estimate.`,
        details: [
          `${top.projectName} has used ${top.trackedHours}h of ${top.estimatedHours}h planned (${Math.round((top.trackedHours / top.estimatedHours) * 100)}%).`,
          `Tasks remaining: ${top.openTasksCount}. Projected total at completion: ${top.projectedHoursAtCompletion}h.`,
        ],
        facts: {
          atRiskCount: atRisk.length,
          topProject: top.projectName,
          trackedHours: top.trackedHours,
          estimatedHours: top.estimatedHours,
        },
      };
    }

    return {
      question,
      headline: "All active projects are currently within their planned time estimates.",
      details: [
        `Evaluated ${predictions.totalProjects} active projects.`,
        `Total tracked time across projects: ${predictions.totalTrackedHours}h vs ${predictions.totalEstimatedHours}h planned.`,
      ],
      facts: {
        totalProjects: predictions.totalProjects,
        totalTrackedHours: predictions.totalTrackedHours,
        totalEstimatedHours: predictions.totalEstimatedHours,
      },
    };
  }

  // Question 2: Workload / who is working / capacity
  if (
    q.includes("iş yükü") ||
    q.includes("workload") ||
    q.includes("kim çalış") ||
    q.includes("capacity") ||
    q.includes("kapasite") ||
    q.includes("overload")
  ) {
    const workload = await getWorkloadAnalysis(context, { periodDays: 7 }, db);
    const overloaded = workload.items.filter((i) => i.status === "OVERUTILIZED");
    const underutilized = workload.items.filter((i) => i.status === "UNDERUTILIZED");

    return {
      question,
      headline: `Workload evaluated across ${workload.totalEmployees} active employees for the past 7 days.`,
      details: [
        `Overutilized employees (>115% capacity): ${overloaded.length} (${overloaded.map((e) => `${e.employeeName} ${e.capacityUtilizationPercent}%`).join(", ") || "None"}).`,
        `Underutilized employees (<65% capacity): ${underutilized.length} (${underutilized.map((e) => `${e.employeeName} ${e.capacityUtilizationPercent}%`).join(", ") || "None"}).`,
        `Team average capacity utilization: ${workload.averageCapacityUtilization}%.`,
        `Workload balance rating: ${100 - workload.workloadImbalanceScore}/100.`,
      ],
      facts: {
        totalEmployees: workload.totalEmployees,
        overutilizedCount: overloaded.length,
        underutilizedCount: underutilized.length,
        averageUtilization: workload.averageCapacityUtilization,
      },
    };
  }

  // Question 3: Specific Employee Activity (e.g. "What did Mehmet do today?")
  const employees = await db.employee.findMany({
    where: tenantWhere(context.companyId, { status: EmployeeStatus.ACTIVE }),
    select: { id: true, firstName: true, lastName: true },
  });

  for (const emp of employees) {
    const firstName = emp.firstName.toLowerCase();
    const lastName = emp.lastName.toLowerCase();
    if (q.includes(firstName) || (lastName.length > 2 && q.includes(lastName))) {
      // Find this employee's recent activity
      const isToday = q.includes("bugün") || q.includes("today");
      const periodDays = isToday ? 1 : 7;
      const startDate = new Date(Date.now() - periodDays * 86_400_000);

      const [activities, idleRow] = await Promise.all([
        db.activity.findMany({
          where: tenantWhere(context.companyId, {
            employeeId: emp.id,
            type: ActivityType.APPLICATION,
            startAt: { gte: startDate },
          }),
          select: {
            durationSeconds: true,
            applicationName: true,
            processName: true,
            project: { select: { name: true, code: true } },
            task: { select: { title: true } },
          },
        }),
        db.activity.aggregate({
          where: tenantWhere(context.companyId, {
            employeeId: emp.id,
            type: ActivityType.IDLE,
            startAt: { gte: startDate },
          }),
          _sum: { durationSeconds: true },
        }),
      ]);

      const totalSec = activities.reduce((sum: number, a: any) => sum + a.durationSeconds, 0);
      const activeHours = Math.round((totalSec / 3600) * 10) / 10;
      const idleSec = idleRow._sum?.durationSeconds ?? 0;
      const idleHours = Math.round((idleSec / 3600) * 10) / 10;

      // Group by app
      const appMap = new Map<string, number>();
      for (const a of activities) {
        const app = a.applicationName?.trim() || "Other";
        appMap.set(app, (appMap.get(app) ?? 0) + a.durationSeconds);
      }
      const topApps = Array.from(appMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, sec]) => `${name} (${Math.round((sec / 3600) * 10) / 10}h)`);

      return {
        question,
        headline: `${emp.firstName} ${emp.lastName} logged ${activeHours} hours of active time (${isToday ? "today" : "past 7 days"}).`,
        details: [
          `Active application time: ${activeHours}h, Idle time: ${idleHours}h.`,
          `Top applications used: ${topApps.join(", ") || "None recorded"}.`,
        ],
        facts: {
          employee: `${emp.firstName} ${emp.lastName}`,
          activeHours,
          idleHours,
        },
      };
    }
  }

  // Fallback: General intelligence briefing summary
  const briefing = await generateExecutiveBriefing(context, "week", db);
  return {
    question,
    headline: briefing.executiveSummary,
    details: briefing.keyFindings,
    facts: {
      activeEmployees: briefing.metrics.activeEmployees,
      totalHours: briefing.metrics.totalActiveHours,
      cadHours: briefing.metrics.cadTimeHours,
    },
  };
}
