"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";

export function DeleteTimeEntryButton({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this time entry?")) {
      return;
    }

    setLoading(true);
    try {
      await deleteJson(`/api/my/time-entries/${id}`);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete time entry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      disabled={loading}
      onClick={handleDelete}
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
      title={t.common.delete}
    >
      <Trash2 className="h-4 w-4" />
      <span className="sr-only">{t.common.delete}</span>
    </Button>
  );
}
