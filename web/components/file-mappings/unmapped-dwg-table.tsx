"use client";

import { FileWarning, Link2 } from "lucide-react";
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
  const { locale } = useI18n();

  function formatTimestamp(date: Date | string) {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-amber-500" />
          <CardTitle>Unmapped CAD / DWG Drawings</CardTitle>
        </div>
        <CardDescription>
          Drawings detected by activity agents that have not yet been assigned to a project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unmappedFiles.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="p-3">DWG Filename</th>
                  <th className="p-3">Employees</th>
                  <th className="p-3">First Seen</th>
                  <th className="p-3">Last Seen</th>
                  <th className="p-3">Active Duration</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {unmappedFiles.map((file) => (
                  <tr key={file.normalizedFileName} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold text-foreground">
                      {file.fileName}
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
                    <td className="p-3 text-muted-foreground text-xs">
                      {formatTimestamp(file.firstSeenAt)}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {formatTimestamp(file.lastSeenAt)}
                    </td>
                    <td className="p-3 font-medium">
                      {formatDurationFromSeconds(file.activeSeconds, locale)}
                    </td>
                    <td className="p-3 text-right">
                      <MapFileDialog
                        initialFileName={file.fileName}
                        projects={projects}
                        tasks={tasks}
                        trigger={
                          <Button size="sm" variant="outline">
                            <Link2 className="h-3.5 w-3.5 mr-1" />
                            Map DWG
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description="All active AutoCAD files reported by agents are currently mapped to projects."
            title="No unmapped drawings"
          />
        )}
      </CardContent>
    </Card>
  );
}
