import { ManagerDashboard } from "@/components/manager/manager-dashboard";
import { requireManager, toAuthContext } from "@/lib/auth";
import {
  getManagerDashboardMetrics,
  listRecentCompanyActivity,
} from "@/lib/services/dashboard";
import { listProjects } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";

export default async function DashboardPage() {
  const session = await requireManager();
  const context = toAuthContext(session);
  const [metrics, projects, tasks, recentActivities] = await Promise.all([
    getManagerDashboardMetrics(context),
    listProjects(context),
    listTasks(context),
    listRecentCompanyActivity(context),
  ]);

  return (
    <ManagerDashboard
      metrics={metrics}
      projects={projects.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
        clientName: project.clientName,
        status: project.status,
        endDate: project.endDate,
        estimatedHours: project.estimatedHours,
        taskCount: project._count.tasks,
      }))}
      recentActivities={recentActivities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        applicationName: activity.applicationName,
        fileName: activity.fileName,
        durationSeconds: activity.durationSeconds,
        startAt: activity.startAt,
        employeeId: activity.employee.id,
        employeeName: `${activity.employee.firstName} ${activity.employee.lastName}`,
        projectCode: activity.project?.code ?? null,
        taskTitle: activity.task?.title ?? null,
      }))}
      tasks={tasks
        .filter(
          ({ status }) => status !== "COMPLETED" && status !== "CANCELLED",
        )
        .sort((left, right) => {
          const priorityRank = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          return priorityRank[left.priority] - priorityRank[right.priority];
        })
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          projectCode: task.project.code,
          assignees: task.assignments.map(
            ({ employee }) => `${employee.firstName} ${employee.lastName}`,
          ),
        }))}
    />
  );
}
