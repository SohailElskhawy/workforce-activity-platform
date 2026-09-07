"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
  XCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/states/empty-state";
import { patchJson, postJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import type {
  AnomalySeverity,
  AnomalyStatus,
  AnomalyType,
} from "@/src/generated/prisma/client";

export type AnomalyRow = {
  id: string;
  companyId: string;
  employeeId: string;
  projectId: string | null;
  taskId: string | null;
  type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  title: string;
  description: string;
  fingerprint: string;
  detectedAt: Date | string;
  periodStart: Date | string;
  periodEnd: Date | string;
  metadata: unknown;
  resolvedAt: Date | string | null;
  resolvedById: string | null;
  resolutionNotes: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  project?: {
    id: string;
    code: string;
    name: string;
  } | null;
  task?: {
    id: string;
    title: string;
  } | null;
  resolvedBy?: {
    id: string;
    email: string;
  } | null;
};

export type AnomalyKpis = {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
  dismissed: number;
  timeDiscrepancy: number;
  projectMismatch: number;
  idleSpike: number;
};

export function AnomaliesUI({
  initialAnomalies,
  initialKpis,
  employees,
}: {
  initialAnomalies: AnomalyRow[];
  initialKpis: AnomalyKpis;
  employees: Array<{ id: string; firstName: string; lastName: string }>;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();

  const [anomalies, setAnomalies] = useState<AnomalyRow[]>(initialAnomalies);
  const [kpis, setKpis] = useState<AnomalyKpis>(initialKpis);

  // Filter states
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("ALL");

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanDays, setScanDays] = useState<number>(7);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Review dialog state
  const [actionDialog, setActionDialog] = useState<{
    anomaly: AnomalyRow;
    nextStatus: AnomalyStatus;
  } | null>(null);
  const [notesInput, setNotesInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Filtered anomalies
  const filteredAnomalies = anomalies.filter((item) => {
    if (filterType !== "ALL" && item.type !== filterType) return false;
    if (filterSeverity !== "ALL" && item.severity !== filterSeverity) return false;
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    if (filterEmployeeId !== "ALL" && item.employeeId !== filterEmployeeId)
      return false;
    return true;
  });

  function formatTimestamp(val: Date | string) {
    const d = typeof val === "string" ? new Date(val) : val;
    return d.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  async function handleRunScan() {
    setIsScanning(true);
    setFeedback(null);
    try {
      const now = new Date();
      const start = new Date(now.getTime() - scanDays * 86400000);
      const res = await postJson<{
        draftsFound: number;
        createdCount: number;
        updatedCount: number;
        preservedCount: number;
      }>("/api/anomalies", {
        startDate: start.toISOString(),
        endDate: now.toISOString(),
        employeeId: filterEmployeeId !== "ALL" ? filterEmployeeId : undefined,
      });

      const createdCount = res?.createdCount ?? 0;
      const preservedCount = res?.preservedCount ?? 0;

      setFeedback(
        locale === "tr"
          ? `Tarama tamamlandı: ${createdCount} yeni kayıt, ${preservedCount} önceden incelenmiş kayıt korundu.`
          : `Scan complete: ${createdCount} new items detected, ${preservedCount} previously reviewed items preserved.`,
      );

      // Refresh list
      const freshRes = await fetch("/api/anomalies").then((r) => r.json());
      const payload = freshRes?.data ?? freshRes;
      if (payload?.items) {
        setAnomalies(payload.items);
        setKpis(payload.kpis);
      }
      router.refresh();
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Failed to run anomaly scan.",
      );
    } finally {
      setIsScanning(false);
    }
  }

  async function submitReviewAction() {
    if (!actionDialog) return;
    setActionLoading(true);
    try {
      await patchJson(`/api/anomalies/${actionDialog.anomaly.id}`, {
        status: actionDialog.nextStatus,
        resolutionNotes: notesInput.trim() ? notesInput.trim() : null,
      });

      // Update state locally
      setAnomalies((prev) =>
        prev.map((item) =>
          item.id === actionDialog.anomaly.id
            ? {
                ...item,
                status: actionDialog.nextStatus,
                resolutionNotes: notesInput.trim() ? notesInput.trim() : null,
                resolvedAt: new Date().toISOString(),
              }
            : item,
        ),
      );

      // Refresh KPIs
      setKpis((prev) => {
        const next = { ...prev };
        if (actionDialog.anomaly.status === "OPEN") next.open--;
        if (actionDialog.nextStatus === "ACKNOWLEDGED") next.acknowledged++;
        if (actionDialog.nextStatus === "RESOLVED") next.resolved++;
        if (actionDialog.nextStatus === "DISMISSED") next.dismissed++;
        return next;
      });

      setActionDialog(null);
      setNotesInput("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  }

  function getSeverityBadge(severity: AnomalySeverity) {
    if (severity === "HIGH") {
      return <Badge variant="destructive">HIGH</Badge>;
    }
    if (severity === "MEDIUM") {
      return (
        <Badge className="bg-amber-600 hover:bg-amber-700 text-white">
          MEDIUM
        </Badge>
      );
    }
    return <Badge variant="secondary">LOW</Badge>;
  }

  function getStatusBadge(status: AnomalyStatus) {
    switch (status) {
      case "OPEN":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
            OPEN
          </Badge>
        );
      case "ACKNOWLEDGED":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
            ACKNOWLEDGED
          </Badge>
        );
      case "RESOLVED":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
            RESOLVED
          </Badge>
        );
      case "DISMISSED":
        return <Badge variant="secondary">DISMISSED</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Overview Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.anomalies.openItems}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {kpis.open}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.total} {locale === "tr" ? "toplam kayıt" : "total records"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.anomalies.timeDiscrepancies}
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.timeDiscrepancy}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "tr" ? "Manuel vs aktivite farkları" : "Manual vs active differences"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.anomalies.projectMismatches}
            </CardTitle>
            <Layers className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.projectMismatch}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "tr" ? "Eşzamanlı proje çakışmaları" : "Concurrent project overlaps"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.anomalies.inactivityNotices}
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.idleSpike}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locale === "tr" ? "Gözlemlenen oturum hareketsizlikleri" : "Observed session idle spikes"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action & Filter Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {locale === "tr" ? "Filtreler ve Tarama" : "Filters & Scanner"}
              </CardTitle>
              <CardDescription>
                {locale === "tr"
                  ? "İnceleme kayıtlarını filtreleyin veya seçili dönem için yeni tarama başlatın."
                  : "Filter review records or run a new scan for the selected period."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                aria-label="Scan days range"
                value={scanDays}
                onChange={(e) => setScanDays(parseInt(e.target.value, 10))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={7}>{locale === "tr" ? "Son 7 gün" : "Last 7 days"}</option>
                <option value={14}>{locale === "tr" ? "Son 14 gün" : "Last 14 days"}</option>
                <option value={30}>{locale === "tr" ? "Son 30 gün" : "Last 30 days"}</option>
              </select>
              <Button
                disabled={isScanning}
                onClick={handleRunScan}
                size="sm"
                className="shrink-0"
              >
                {isScanning ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1.5" />
                )}
                {t.anomalies.runScan}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {feedback ? (
            <div className="mb-4 rounded-md bg-muted p-3 text-sm text-foreground">
              {feedback}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t.anomalies.type}
              </label>
              <select
                aria-label={t.anomalies.type}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ALL">{t.anomalies.allTypes}</option>
                <option value="TIME_DISCREPANCY">
                  {t.anomalies.timeDiscrepancies}
                </option>
                <option value="PROJECT_MISMATCH">
                  {t.anomalies.projectMismatches}
                </option>
                <option value="IDLE_SPIKE">
                  {t.anomalies.inactivityNotices}
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t.anomalies.status}
              </label>
              <select
                aria-label={t.anomalies.status}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ALL">{t.anomalies.allStatuses}</option>
                <option value="OPEN">OPEN</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="DISMISSED">DISMISSED</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t.anomalies.severity}
              </label>
              <select
                aria-label={t.anomalies.severity}
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ALL">{t.anomalies.allSeverities}</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {locale === "tr" ? "Çalışan" : "Employee"}
              </label>
              <select
                aria-label={locale === "tr" ? "Çalışan" : "Employee"}
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ALL">
                  {locale === "tr" ? "Tüm Çalışanlar" : "All Employees"}
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Anomalies Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "tr" ? "İnceleme Kayıtları" : "Review Records"} (
            {filteredAnomalies.length})
          </CardTitle>
          <CardDescription>
            {locale === "tr"
              ? "Çalışanları doğrudan suçlamayan, nesnel inceleme amaçlı kayıt listesi."
              : "Neutral list of observations provided for management review and clarification."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAnomalies.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Type & Severity</th>
                    <th className="p-3">Description & Context</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAnomalies.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="p-3 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatTimestamp(item.periodStart)}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">
                          {item.employee.firstName} {item.employee.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.employee.email}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div>{getSeverityBadge(item.severity)}</div>
                          <Badge variant="outline" className="text-[10px]">
                            {item.type}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3 max-w-md">
                        <div className="font-semibold text-foreground text-xs mb-1">
                          {item.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                        {item.resolutionNotes ? (
                          <div className="mt-1.5 text-[11px] bg-muted/60 p-1.5 rounded border text-muted-foreground">
                            <span className="font-semibold">Note: </span>
                            {item.resolutionNotes}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === "OPEN" ? (
                            <Button
                              onClick={() =>
                                setActionDialog({
                                  anomaly: item,
                                  nextStatus: "ACKNOWLEDGED",
                                })
                              }
                              size="sm"
                              variant="outline"
                            >
                              {t.anomalies.acknowledge}
                            </Button>
                          ) : null}
                          {item.status !== "RESOLVED" ? (
                            <Button
                              onClick={() =>
                                setActionDialog({
                                  anomaly: item,
                                  nextStatus: "RESOLVED",
                                })
                              }
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              {t.anomalies.resolve}
                            </Button>
                          ) : null}
                          {item.status !== "DISMISSED" ? (
                            <Button
                              onClick={() =>
                                setActionDialog({
                                  anomaly: item,
                                  nextStatus: "DISMISSED",
                                })
                              }
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              {t.anomalies.dismiss}
                            </Button>
                          ) : null}
                          {item.status !== "OPEN" ? (
                            <Button
                              onClick={() =>
                                setActionDialog({
                                  anomaly: item,
                                  nextStatus: "OPEN",
                                })
                              }
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              {t.anomalies.reopen}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={t.anomalies.emptyTitle}
              description={t.anomalies.emptyDesc}
            />
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog
        open={Boolean(actionDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setActionDialog(null);
            setNotesInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.nextStatus === "ACKNOWLEDGED"
                ? t.anomalies.acknowledge
                : actionDialog?.nextStatus === "RESOLVED"
                  ? t.anomalies.resolve
                  : actionDialog?.nextStatus === "DISMISSED"
                    ? t.anomalies.dismiss
                    : t.anomalies.reopen}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.anomaly.title} (
              {actionDialog?.anomaly.employee.firstName}{" "}
              {actionDialog?.anomaly.employee.lastName})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {actionDialog?.anomaly.description}
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolution-notes">
                {t.anomalies.resolutionNotes}
              </Label>
              <Textarea
                id="resolution-notes"
                placeholder={t.anomalies.resolutionNotesPlaceholder}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog(null);
                setNotesInput("");
              }}
            >
              {t.anomalies.cancel}
            </Button>
            <Button disabled={actionLoading} onClick={submitReviewAction}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : null}
              {t.anomalies.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
