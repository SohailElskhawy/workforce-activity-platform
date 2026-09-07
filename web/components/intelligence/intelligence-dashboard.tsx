"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  FolderKanban,
  HelpCircle,
  Layers,
  Lightbulb,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import type {
  ClassificationSummary,
  ExecutiveBriefing,
  ManagementRecommendation,
  PredictionSummary,
  QueryAnswer,
  WorkloadSummary,
} from "@/lib/services/analytics-engine";
import {
  type ActivityCategory,
  CATEGORY_LABELS,
} from "@/lib/services/analytics-constants";

export type IntelligenceDashboardProps = {
  initialBriefing: ExecutiveBriefing;
  initialWorkload: WorkloadSummary;
  initialPredictions: PredictionSummary;
  initialClassification: ClassificationSummary;
  initialRecommendations: ManagementRecommendation[];
};

export function IntelligenceDashboard({
  initialBriefing,
  initialWorkload,
  initialPredictions,
  initialClassification,
  initialRecommendations,
}: IntelligenceDashboardProps) {
  const { t, locale } = useI18n();

  const [range, setRange] = useState<"today" | "week" | "month">("week");
  const [briefing, setBriefing] = useState<ExecutiveBriefing>(initialBriefing);
  const [workload, setWorkload] = useState<WorkloadSummary>(initialWorkload);
  const [predictions, setPredictions] = useState<PredictionSummary>(initialPredictions);
  const [classification, setClassification] = useState<ClassificationSummary>(initialClassification);
  const [recommendations, setRecommendations] = useState<ManagementRecommendation[]>(initialRecommendations);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workloadFilter, setWorkloadFilter] = useState<string>("ALL");

  // Q&A State
  const [questionInput, setQuestionInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<QueryAnswer[]>([]);

  async function handleRangeChange(newRange: "today" | "week" | "month") {
    setRange(newRange);
    setIsRefreshing(true);
    try {
      const periodDays = newRange === "today" ? 1 : newRange === "month" ? 30 : 7;
      const [briefingRes, workloadRes, classRes] = await Promise.all([
        fetch(`/api/intelligence/summary?range=${newRange}`).then((r) => r.json()),
        fetch(`/api/intelligence/workload?periodDays=${periodDays}`).then((r) => r.json()),
        fetch(`/api/intelligence/classification?periodDays=${periodDays}`).then((r) => r.json()),
      ]);

      if (briefingRes?.data) setBriefing(briefingRes.data);
      if (workloadRes?.data) setWorkload(workloadRes.data);
      if (classRes?.data) setClassification(classRes.data);
    } catch (error) {
      console.error("Failed to refresh intelligence data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleAskQuestion(query?: string) {
    const q = query || questionInput;
    if (!q.trim()) return;

    setIsAsking(true);
    try {
      const res = await fetch("/api/intelligence/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();
      if (json?.data) {
        setQaHistory((prev) => [json.data, ...prev]);
        setQuestionInput("");
      }
    } catch (error) {
      console.error("Failed to ask question:", error);
    } finally {
      setIsAsking(false);
    }
  }

  const sampleQuestions =
    locale === "tr"
      ? [
          "Bu hafta hangi projeler planlanan sürenin üzerinde?",
          "Çalışan iş yükü ve kapasite durumu nasıl?",
          "En çok süre harcanan AutoCAD projeleri hangileri?",
        ]
      : [
          "Which projects are exceeding planned time?",
          "What is our team workload and capacity status?",
          "Which projects consumed the most AutoCAD hours?",
        ];

  const filteredWorkloadItems = workload.items.filter((item) => {
    if (workloadFilter === "ALL") return true;
    return item.status === workloadFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls: Time Window Selector & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 p-1">
          <Button
            size="sm"
            variant={range === "today" ? "default" : "ghost"}
            onClick={() => handleRangeChange("today")}
            disabled={isRefreshing}
          >
            {t.intelligence.today}
          </Button>
          <Button
            size="sm"
            variant={range === "week" ? "default" : "ghost"}
            onClick={() => handleRangeChange("week")}
            disabled={isRefreshing}
          >
            {t.intelligence.last7Days}
          </Button>
          <Button
            size="sm"
            variant={range === "month" ? "default" : "ghost"}
            onClick={() => handleRangeChange("month")}
            disabled={isRefreshing}
          >
            {t.intelligence.last30Days}
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRangeChange(range)}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {t.intelligence.refreshBriefing}
        </Button>
      </div>

      {/* Main KPI Overview */}
      <KpiGrid>
        <KpiCard
          label={t.intelligence.activeWorkforce}
          value={String(briefing.metrics.activeEmployees)}
          tone="sky"
        />
        <KpiCard
          label={t.intelligence.activeHours}
          value={`${briefing.metrics.totalActiveHours}h`}
          tone="emerald"
        />
        <KpiCard
          label={t.intelligence.cadShare}
          value={`${briefing.metrics.cadTimeHours}h`}
          tone="violet"
        />
        <KpiCard
          label={t.intelligence.overrunProjects}
          value={String(predictions.overrunCount)}
          tone={predictions.overrunCount > 0 ? "rose" : "emerald"}
        />
      </KpiGrid>

      {/* AI Executive Summary Banner */}
      <Card className="border-sky-500/20 bg-gradient-to-br from-sky-500/5 via-transparent to-indigo-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <Sparkles className="size-4" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {t.intelligence.executiveBriefing} — {briefing.periodLabel}
              </CardTitle>
              <CardDescription className="text-xs">
                {locale === "tr"
                  ? "Sistem verilerine dayalı objektif yönetici özeti"
                  : "Objective management briefing compiled from real-time activity metrics"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="leading-relaxed text-foreground/90 font-medium">
            {briefing.executiveSummary}
          </p>

          {briefing.keyFindings.length > 0 && (
            <div className="rounded-lg border bg-background/60 p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.intelligence.keyFindings}
              </h4>
              <ul className="grid gap-2 sm:grid-cols-2 text-xs">
                {briefing.keyFindings.map((finding, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-sky-500 mt-0.5" />
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="workload" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1 gap-1">
          <TabsTrigger value="workload" className="gap-1.5 py-2">
            <Users className="size-4" />
            <span>{t.intelligence.workloadAnalysis}</span>
          </TabsTrigger>
          <TabsTrigger value="predictions" className="gap-1.5 py-2">
            <TrendingUp className="size-4" />
            <span>{t.intelligence.predictions}</span>
          </TabsTrigger>
          <TabsTrigger value="classification" className="gap-1.5 py-2">
            <Layers className="size-4" />
            <span>{t.intelligence.autoClassification}</span>
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-1.5 py-2">
            <Lightbulb className="size-4" />
            <span>{t.intelligence.recommendations}</span>
            {recommendations.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {recommendations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ask" className="gap-1.5 py-2">
            <BrainCircuit className="size-4" />
            <span>{t.intelligence.askIntelligence}</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: WORKLOAD & CAPACITY */}
        <TabsContent value="workload" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t.intelligence.teamCapacity}</CardDescription>
                <CardTitle className="text-2xl">
                  {workload.averageCapacityUtilization}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-sky-500"
                    style={{
                      width: `${Math.min(100, workload.averageCapacityUtilization)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t.intelligence.imbalanceScore}</CardDescription>
                <CardTitle className="text-2xl">
                  {workload.workloadImbalanceScore} / 100
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {workload.workloadImbalanceScore > 40
                    ? locale === "tr"
                      ? "Yüksek dağılım dengesizliği"
                      : "Noticeable workload distribution variance"
                    : locale === "tr"
                      ? "Dengeli iş dağılımı"
                      : "Balanced workload across members"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {locale === "tr" ? "Kapasite Dağılımı" : "Capacity Distribution"}
                </CardDescription>
                <div className="flex gap-2 pt-1">
                  <Badge variant="destructive" className="text-xs">
                    {workload.overutilizedCount} {t.intelligence.overutilized}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {workload.underutilizedCount} {t.intelligence.underutilized}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {workload.optimalCount} {t.intelligence.optimal}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Workload Filter Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={workloadFilter === "ALL" ? "default" : "outline"}
                onClick={() => setWorkloadFilter("ALL")}
              >
                {locale === "tr" ? "Tüm Çalışanlar" : "All Employees"} ({workload.items.length})
              </Button>
              <Button
                size="sm"
                variant={workloadFilter === "OVERUTILIZED" ? "default" : "outline"}
                onClick={() => setWorkloadFilter("OVERUTILIZED")}
              >
                {t.intelligence.overutilized} ({workload.overutilizedCount})
              </Button>
              <Button
                size="sm"
                variant={workloadFilter === "OPTIMAL" ? "default" : "outline"}
                onClick={() => setWorkloadFilter("OPTIMAL")}
              >
                {t.intelligence.optimal} ({workload.optimalCount})
              </Button>
              <Button
                size="sm"
                variant={workloadFilter === "UNDERUTILIZED" ? "default" : "outline"}
                onClick={() => setWorkloadFilter("UNDERUTILIZED")}
              >
                {t.intelligence.underutilized} ({workload.underutilizedCount})
              </Button>
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{locale === "tr" ? "Çalışan" : "Employee"}</TableHead>
                  <TableHead>{locale === "tr" ? "Departman" : "Department"}</TableHead>
                  <TableHead>{locale === "tr" ? "Aktif Süre" : "Active Time"}</TableHead>
                  <TableHead>{locale === "tr" ? "Kapasite Kullanımı" : "Capacity Utilization"}</TableHead>
                  <TableHead>{locale === "tr" ? "Açık Görevler" : "Open Tasks"}</TableHead>
                  <TableHead>{locale === "tr" ? "Kalan Tahmin" : "Est. Remaining"}</TableHead>
                  <TableHead>{locale === "tr" ? "Durum" : "Status"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkloadItems.map((item) => (
                  <TableRow key={item.employeeId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/employees/${item.employeeId}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        {item.employeeName}
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </Link>
                      {item.position && (
                        <span className="block text-xs text-muted-foreground">
                          {item.position}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{item.departmentName ?? "—"}</TableCell>
                    <TableCell>{item.activeHours}h</TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{item.capacityUtilizationPercent}%</span>
                          <span className="text-muted-foreground">/ {item.expectedHours}h</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${
                              item.status === "OVERUTILIZED"
                                ? "bg-rose-500"
                                : item.status === "UNDERUTILIZED"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${Math.min(100, item.capacityUtilizationPercent)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.openTasksCount}</TableCell>
                    <TableCell>{item.remainingEstimatedHours}h</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "OVERUTILIZED"
                            ? "destructive"
                            : item.status === "UNDERUTILIZED"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 2: PROJECT PREDICTIONS */}
        <TabsContent value="predictions" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t.intelligence.overrunProjects}</CardDescription>
                <CardTitle className="text-2xl text-rose-600">
                  {predictions.overrunCount}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {locale === "tr"
                    ? "Planlanan bütçe sınırını aşan projeler"
                    : "Projects exceeding planned hour budget"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t.intelligence.atRiskProjects}</CardDescription>
                <CardTitle className="text-2xl text-amber-600">
                  {predictions.atRiskCount}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {locale === "tr"
                    ? "Bütçenin %85'ine ulaşmış veya aşım riski taşıyanlar"
                    : "Projects reaching 85% capacity or pacing over"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t.intelligence.onTrackProjects}</CardDescription>
                <CardTitle className="text-2xl text-emerald-600">
                  {predictions.onTrackCount}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {locale === "tr"
                    ? "Planlanan bütçe dahilinde ilerleyen projeler"
                    : "Projects operating safely within budget"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{locale === "tr" ? "Proje" : "Project"}</TableHead>
                  <TableHead>{locale === "tr" ? "Planlanan" : "Estimated"}</TableHead>
                  <TableHead>{locale === "tr" ? "Gerçekleşen" : "Tracked"}</TableHead>
                  <TableHead>{locale === "tr" ? "Manuel Süre" : "Manual"}</TableHead>
                  <TableHead>{locale === "tr" ? "İlerleme" : "Progress"}</TableHead>
                  <TableHead>{t.intelligence.projectedCompletion}</TableHead>
                  <TableHead>{locale === "tr" ? "En Çok Süre" : "Main Contributor"}</TableHead>
                  <TableHead>{t.intelligence.riskLevel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {predictions.projects.map((p) => (
                  <TableRow key={p.projectId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/projects/${p.projectId}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        {p.projectName}
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {p.projectCode}
                      </span>
                    </TableCell>
                    <TableCell>{p.estimatedHours}h</TableCell>
                    <TableCell className="font-medium">
                      <span className={p.isOverrun ? "text-rose-600 font-semibold" : ""}>
                        {p.trackedHours}h
                      </span>
                      {p.isOverrun && (
                        <span className="block text-[11px] text-rose-500">
                          +{p.varianceHours}h
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.manualHours}h
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{p.completionPercent}%</span>
                          <span className="text-muted-foreground">
                            {p.completedTasksCount}/{p.totalTasksCount}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-sky-500"
                            style={{ width: `${p.completionPercent}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.projectedHoursAtCompletion}h
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.topContributor ? (
                        <div>
                          <span className="font-medium">{p.topContributor.name}</span>
                          <span className="text-muted-foreground block">
                            {p.topContributor.hours}h
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.overrunRisk === "CRITICAL"
                            ? "destructive"
                            : p.overrunRisk === "HIGH"
                              ? "destructive"
                              : p.overrunRisk === "MEDIUM"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {p.overrunRisk}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 3: AUTO-CLASSIFICATION */}
        <TabsContent value="classification" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classification.categories.map((cat) => {
              const meta = CATEGORY_LABELS[cat.category];
              return (
                <Card key={cat.category}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {locale === "tr" ? meta.tr : meta.en}
                      </CardTitle>
                      <Badge variant="outline" className="font-mono">
                        {cat.percentage}%
                      </Badge>
                    </div>
                    <CardDescription>{cat.durationHours} hours active</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>

                    {cat.topApplications.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                          {locale === "tr" ? "En Çok Kullanılanlar" : "Top Applications"}
                        </span>
                        <div className="space-y-1 text-xs">
                          {cat.topApplications.map((app, i) => (
                            <div key={i} className="flex justify-between items-center py-0.5">
                              <span className="truncate max-w-[180px]">{app.name}</span>
                              <span className="font-mono text-muted-foreground">
                                {app.durationHours}h
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {classification.departmentBreakdown &&
            classification.departmentBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {locale === "tr"
                      ? "Departman Bazında Uygulama Dağılımı (Saat)"
                      : "Application Category Breakdown by Department (Hours)"}
                  </CardTitle>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{locale === "tr" ? "Departman" : "Department"}</TableHead>
                      <TableHead>Engineering / CAD</TableHead>
                      <TableHead>Office & Docs</TableHead>
                      <TableHead>Communication</TableHead>
                      <TableHead>Technical Tools</TableHead>
                      <TableHead>Web & Research</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classification.departmentBreakdown.map((dept, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{dept.departmentName}</TableCell>
                        <TableCell>{dept.categories.ENGINEERING_CAD}h</TableCell>
                        <TableCell>{dept.categories.OFFICE_DOCS}h</TableCell>
                        <TableCell>{dept.categories.COMMUNICATION}h</TableCell>
                        <TableCell>{dept.categories.DEV_TECHNICAL}h</TableCell>
                        <TableCell>{dept.categories.BROWSING_RESEARCH}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
        </TabsContent>

        {/* TAB 4: MANAGEMENT RECOMMENDATIONS */}
        <TabsContent value="recommendations" className="space-y-4">
          <div className="space-y-3">
            {recommendations.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto size-8 text-emerald-500 mb-2" />
                <p>
                  {locale === "tr"
                    ? "Şu anda bekleyen kritik yönetim uyarısı bulunmamaktadır."
                    : "No critical management recommendations at this time. Operations are well-balanced."}
                </p>
              </Card>
            ) : (
              recommendations.map((rec) => (
                <Card
                  key={rec.id}
                  className={`border-l-4 ${
                    rec.severity === "CRITICAL"
                      ? "border-l-rose-500"
                      : rec.severity === "WARNING"
                        ? "border-l-amber-500"
                        : "border-l-sky-500"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {rec.severity === "CRITICAL" ? (
                          <Flame className="size-4 text-rose-500" />
                        ) : rec.severity === "WARNING" ? (
                          <AlertTriangle className="size-4 text-amber-500" />
                        ) : (
                          <Lightbulb className="size-4 text-sky-500" />
                        )}
                        <CardTitle className="text-base">{rec.title}</CardTitle>
                      </div>
                      <Badge
                        variant={
                          rec.severity === "CRITICAL"
                            ? "destructive"
                            : rec.severity === "WARNING"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {rec.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {rec.description}
                    </p>
                    <div className="flex justify-end">
                      <Link
                        href={rec.actionHref}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground gap-1.5"
                      >
                        {rec.actionText}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 5: ASK INTELLIGENCE (Q&A) */}
        <TabsContent value="ask" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BrainCircuit className="size-5 text-sky-500" />
                <CardTitle className="text-base">{t.intelligence.askIntelligence}</CardTitle>
              </div>
              <CardDescription>
                {locale === "tr"
                  ? "Sistem kayıtlarındaki aktivite, proje ve çalışan verileri hakkında doğrudan soru sorun."
                  : "Ask questions grounded directly on actual recorded platform activity and project data."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sample Prompt Chips */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {t.intelligence.sampleQueries}
                </span>
                <div className="flex flex-wrap gap-2">
                  {sampleQuestions.map((prompt, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleAskQuestion(prompt)}
                      disabled={isAsking}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Input & Ask Button */}
              <div className="flex gap-2">
                <Input
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={t.intelligence.askPromptPlaceholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAskQuestion();
                  }}
                  disabled={isAsking}
                />
                <Button
                  onClick={() => handleAskQuestion()}
                  disabled={isAsking || !questionInput.trim()}
                  className="gap-2"
                >
                  <Send className="size-4" />
                  {t.intelligence.askButton}
                </Button>
              </div>

              {/* QA Responses */}
              {qaHistory.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  {qaHistory.map((item, index) => (
                    <Card key={index} className="bg-muted/20 border">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <HelpCircle className="size-3.5" />
                          <span>{item.question}</span>
                        </div>
                        <CardTitle className="text-base font-medium pt-1 text-foreground">
                          {item.headline}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          {item.details.map((d, dIdx) => (
                            <li key={dIdx} className="flex items-start gap-2">
                              <span className="size-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
