"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

export function DeleteDepartmentButton({
  departmentId,
  departmentName,
  redirectOnSuccess,
}: {
  departmentId: string;
  departmentName: string;
  redirectOnSuccess?: string;
}) {
  const { formatError, t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteJson(`/api/departments/${departmentId}`);
      toast({
        title: t.departments.deletedSuccess,
        variant: "success",
      });
      setOpen(false);
      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast({
        title: formatError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
      >
        <Trash2 className="size-3.5" />
        <span>{t.common.delete}</span>
      </Button>

      <ConfirmationDialog
        cancelLabel={t.common.cancel}
        confirmLabel={t.common.delete}
        description={t.departments.deleteDesc}
        isSubmitting={loading}
        onConfirm={handleDelete}
        onOpenChange={setOpen}
        open={open}
        title={`${t.departments.deleteTitle}: ${departmentName}`}
        variant="destructive"
      />
    </>
  );
}
