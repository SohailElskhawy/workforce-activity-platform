"use client";

import { Shield, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/states/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import { formatTemplate } from "@/lib/i18n/format";
import { useToast } from "@/lib/toast";

import { AddExclusionDialog } from "./add-exclusion-dialog";

export type ExcludedApplicationItem = {
  id: string;
  processName: string;
  displayName: string | null;
  createdAt: Date | string;
};

export function ExcludedAppsCard({
  excludedApplications,
}: {
  excludedApplications: ExcludedApplicationItem[];
}) {
  const { formatError, t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();

  const [deletingApp, setDeletingApp] = useState<ExcludedApplicationItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteConfirm() {
    if (!deletingApp) return;
    setIsDeleting(true);

    try {
      await deleteJson(`/api/settings/tracking/exclusions/${deletingApp.id}`);
      toast({
        title: t.settings.excludedAppsCard.deleteSuccess,
        variant: "success",
      });
      setDeletingApp(null);
      router.refresh();
    } catch (error) {
      toast({
        title: formatError(error),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" />
            <CardTitle>{t.settings.excludedAppsCard.title}</CardTitle>
          </div>
          <CardDescription>
            {t.settings.excludedAppsCard.desc}
          </CardDescription>
          <CardAction>
            <AddExclusionDialog />
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Privacy Note Banner */}
          <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
            <Shield className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {t.settings.excludedAppsCard.privacyNoticeTitle}
              </p>
              <p className="text-muted-foreground">
                {t.settings.excludedAppsCard.privacyNoticeDesc}
              </p>
            </div>
          </div>

          {/* Applications Table or Empty State */}
          {excludedApplications.length === 0 ? (
            <EmptyState
              description={t.settings.excludedAppsCard.emptyDesc}
              icon={Shield}
              title={t.settings.excludedAppsCard.emptyTitle}
            />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">
                      {t.settings.excludedAppsCard.processNameHeader}
                    </TableHead>
                    <TableHead className="w-[35%]">
                      {t.settings.excludedAppsCard.displayNameHeader}
                    </TableHead>
                    <TableHead className="w-[20%]">
                      {t.settings.excludedAppsCard.dateAddedHeader}
                    </TableHead>
                    <TableHead className="w-[15%] text-right">
                      {t.settings.excludedAppsCard.actionsHeader}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excludedApplications.map((app) => {
                    const dateStr = new Date(app.createdAt).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    );

                    return (
                      <TableRow key={app.id}>
                        <TableCell>
                          <Badge
                            className="font-mono text-xs font-normal"
                            variant="secondary"
                          >
                            {app.processName}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {app.displayName ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {dateStr}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingApp(app)}
                            size="icon"
                            title={t.common.delete}
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">{t.common.delete}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        cancelLabel={t.common.cancel}
        confirmLabel={t.common.delete}
        description={
          deletingApp
            ? formatTemplate(t.settings.excludedAppsCard.deleteModalDesc, {
                name: deletingApp.displayName || deletingApp.processName,
              })
            : ""
        }
        isSubmitting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeletingApp(null);
          }
        }}
        open={Boolean(deletingApp)}
        title={t.settings.excludedAppsCard.deleteModalTitle}
        variant="destructive"
      />
    </>
  );
}
