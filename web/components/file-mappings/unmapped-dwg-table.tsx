"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileWarning, Link2, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { MapFileDialog } from "@/components/file-mappings/map-file-dialog";
import { formatDurationFromSeconds } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client/api";
import { matchDwgFile, type ProjectCandidate } from "@/lib/services/dwg-matcher";
import type { UnmappedDwgFile } from "@/lib/services/dwg-reports";

type ProjectOption = { id: string; code: string; name: string };
type TaskOption = { id: string; project: { id: string }; title: string };

export function UnmappedDwgTable({
  unmappedFiles,
  projects,
  tasks,
}: {
  unmappedFiles: UnmappedDwgFile[];
  projects: ProjectOption[];
  tasks: TaskOption[];
}) {
  const { locale, t } = useI18n();
  const router = useRouter();

  const [applyingBatch, setApplyingBatch] = useState(false);
  const [acceptingFileName, setAcceptingFileName] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prepare project candidates with associated tasks for the matcher
  const projectCandidates: ProjectCandidate[] = useMemo(() => {
    return projects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      tasks: tasks
        .filter((t) => t.project.id === p.id)
        .map((t) => ({ id: t.id, title: t.title })),
    }));
  }, [projects, tasks]);

  // Compute deterministic matches for all unmapped files
  const matchedFiles = useMemo(() => {
    return unmappedFiles.map((file) => {
      const match = matchDwgFile(file.fileName, projectCandidates);
      return {
        ...file,
        match,
      };
    });
  }, [unmappedFiles, projectCandidates]);

  // Count high confidence (>= 95% unambiguous) matches
  const highConfidenceCount = useMemo(() => {
    return matchedFiles.filter(
      (f) => f.match.autoAppliable && f.match.confidence >= 0.95,
    ).length;
  }, [matchedFiles]);

  function formatTimestamp(date: Date | string) {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleApplyHighConfidence() {
    setApplyingBatch(true);
    setFeedbackMessage(null);
    setErrorMessage(null);
    try {
      const res = await postJson<{ appliedCount: number; matchedFileNames: string[] }>(
        "/api/file-mappings/auto-match",
        { action: "apply-high-confidence" },
      );
      const appliedCount = res?.appliedCount ?? 0;
      setFeedbackMessage(
        locale === "tr"
          ? `${appliedCount} yüksek güvenli DWG eşleştirmesi uygulandı.`
          : `Applied ${appliedCount} high-confidence DWG file mappings.`,
      );
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to apply automatic matches",
      );
    } finally {
      setApplyingBatch(false);
    }
  }

  async function handleAcceptSuggestion(
    fileName: string,
    projectId: string,
    taskId?: string | null,
  ) {
    setAcceptingFileName(fileName);
    setFeedbackMessage(null);
    setErrorMessage(null);
    try {
      await postJson("/api/file-mappings/auto-match", {
        action: "accept-suggestion",
        fileName,
        projectId,
        taskId: taskId ?? null,
      });
      setFeedbackMessage(
        locale === "tr"
          ? `"${fileName}" eşleştirmesi onaylandı.`
          : `Match for "${fileName}" accepted.`,
      );
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to accept match suggestion",
      );
    } finally {
      setAcceptingFileName(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-amber-500" />
              <CardTitle>
                {locale === "tr" ? "Eşleşmemiş CAD / DWG Çizimleri" : "Unmapped CAD / DWG Drawings"}
              </CardTitle>
            </div>
            <CardDescription>
              {locale === "tr"
                ? "Ajanlar tarafından tespit edilen ve henüz bir projeye atanmamış çizimler."
                : "Drawings detected by activity agents that have not yet been assigned to a project."}
            </CardDescription>
          </div>
          {highConfidenceCount > 0 ? (
            <Button
              disabled={applyingBatch}
              onClick={handleApplyHighConfidence}
              className="shrink-0"
              size="sm"
            >
              {applyingBatch ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1.5 text-amber-300" />
              )}
              {t.dwgMatching.applyHighConfidence} ({highConfidenceCount})
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedbackMessage ? (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-800 dark:text-emerald-200">
            {feedbackMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {matchedFiles.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="p-3">DWG Filename</th>
                  <th className="p-3">Suggested Project & Match</th>
                  <th className="p-3">Employees</th>
                  <th className="p-3">Active Duration</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {matchedFiles.map((file) => {
                  const hasSuggestion = Boolean(file.match.matchedProject);
                  const isHighConfidence =
                    file.match.autoAppliable && file.match.confidence >= 0.95;
                  const isAmbiguous = file.match.ambiguous;

                  return (
                    <tr key={file.normalizedFileName} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold text-foreground">
                        <div>{file.fileName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatTimestamp(file.lastSeenAt)}
                        </div>
                      </td>
                      <td className="p-3">
                        {hasSuggestion ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground">
                                {file.match.matchedProject?.name}
                              </span>
                              <Badge variant="outline" className="text-xs font-mono">
                                {file.match.matchedProject?.code}
                              </Badge>
                              {isHighConfidence ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
                                  {t.dwgMatching.highConfidenceBadge} (
                                  {Math.round(file.match.confidence * 100)}%)
                                </Badge>
                              ) : isAmbiguous ? (
                                <Badge variant="destructive" className="text-[10px]">
                                  {t.dwgMatching.ambiguousBadge}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  {t.dwgMatching.suggestedBadge} (
                                  {Math.round(file.match.confidence * 100)}%)
                                </Badge>
                              )}
                            </div>
                            {file.match.matchedTask ? (
                              <div className="text-xs text-muted-foreground">
                                Task: {file.match.matchedTask.title}
                              </div>
                            ) : null}
                            <div className="text-[11px] text-muted-foreground italic">
                              {file.match.explanation}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {locale === "tr" ? "Öneri bulunamadı" : "No suggestion"}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {file.employees.map((emp) => (
                            <Badge key={emp.id} variant="secondary">
                              {emp.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-medium">
                        {formatDurationFromSeconds(file.activeSeconds, locale)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasSuggestion && file.match.matchedProject ? (
                            <Button
                              disabled={acceptingFileName === file.fileName}
                              onClick={() =>
                                handleAcceptSuggestion(
                                  file.fileName,
                                  file.match.matchedProject!.id,
                                  file.match.matchedTask?.id,
                                )
                              }
                              size="sm"
                              variant={isHighConfidence ? "default" : "secondary"}
                            >
                              {acceptingFileName === file.fileName ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5 mr-1" />
                              )}
                              {t.dwgMatching.acceptMatch}
                            </Button>
                          ) : null}
                          <MapFileDialog
                            initialFileName={file.fileName}
                            projects={projects}
                            tasks={tasks}
                            trigger={
                              <Button size="sm" variant="outline">
                                <Link2 className="h-3.5 w-3.5 mr-1" />
                                {locale === "tr" ? "Manuel Eşle" : "Manual Map"}
                              </Button>
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description={
              locale === "tr"
                ? "Ajanlar tarafından bildirilen tüm AutoCAD dosyaları projelere eşlenmiştir."
                : "All active AutoCAD files reported by agents are currently mapped to projects."
            }
            title={locale === "tr" ? "Eşleşmemiş çizim yok" : "No unmapped drawings"}
          />
        )}
      </CardContent>
    </Card>
  );
}
