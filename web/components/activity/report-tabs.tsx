"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ReportTabsProps = { active: string; idle: string; employees: string; overdue: string };

export function ReportTabs({ active, idle, employees, overdue }: ReportTabsProps) {
  return <Tabs defaultValue="employee"><TabsList><TabsTrigger value="employee">Employee Summary</TabsTrigger><TabsTrigger value="project">Project Summary</TabsTrigger><TabsTrigger value="task">Task Summary</TabsTrigger><TabsTrigger value="difference">Manual vs Activity</TabsTrigger></TabsList><TabsContent value="employee"><p className="pt-4">{employees} employees are available from the Activities screen for individual activity summaries.</p></TabsContent><TabsContent value="project"><p className="pt-4">Project activity is available through the project report endpoint; active time currently totals {active} across today&apos;s activity.</p></TabsContent><TabsContent value="task"><p className="pt-4">{overdue} tasks are overdue. Task activity and manual-time summaries are available through the task report endpoint.</p></TabsContent><TabsContent value="difference"><p className="pt-4">Automated activity: {active}. Idle: {idle}. Manual time remains a separate dataset and is never added to activity time.</p></TabsContent></Tabs>;
}
