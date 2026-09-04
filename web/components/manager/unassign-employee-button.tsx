"use client";

import { UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";

export function UnassignEmployeeButton({
  taskId,
  employeeId,
  employeeName,
}: {
  taskId: string;
  employeeId: string;
  employeeName: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUnassign() {
    if (
      !confirm(
        `Are you sure you want to unassign ${employeeName} from this task?`,
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await deleteJson(`/api/tasks/${taskId}/assignments`, { employeeId });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to unassign employee.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      disabled={loading}
      onClick={handleUnassign}
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
      title="Unassign employee"
    >
      <UserMinus className="h-4 w-4" />
      <span className="sr-only">Unassign</span>
    </Button>
  );
}
