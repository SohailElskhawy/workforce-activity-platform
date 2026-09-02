"use client";

import { useState, useTransition } from "react";

import { taskStatusSchema } from "@/lib/validation/tasks";
import { ClientRequestError, sendJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";

export function UpdateTaskStatus({
  status,
  taskId,
}: {
  status: string;
  taskId: string;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(nextStatus: string) {
    const previousStatus = value;
    setValue(nextStatus);
    setError(null);

    startTransition(async () => {
      try {
        await sendJson(`/api/my/tasks/${taskId}`, "PATCH", {
          status: nextStatus,
        });
      } catch (caughtError) {
        setValue(previousStatus);
        setError(
          caughtError instanceof ClientRequestError
            ? caughtError.message
            : "Unable to update the task.",
        );
      }
    });
  }

  return (
    <div className="space-y-1">
      <select
        aria-label="Task status"
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        disabled={isPending}
        onChange={(event) => updateStatus(event.target.value)}
        value={value}
      >
        {taskStatusSchema.options.map((option) => (
          <option key={option} value={option}>
            {option in t.status
              ? t.status[option as keyof typeof t.status]
              : option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      {error ? (
        <p className="max-w-48 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

