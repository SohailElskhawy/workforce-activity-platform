"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export type DataErrorProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function DataError({
  className = "",
  message,
  onRetry,
  title,
}: DataErrorProps) {
  const { t } = useI18n();
  const displayTitle = title ?? t.states.errorTitle;
  const displayMessage = message ?? t.states.errorTitle;

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-8 px-4 text-center ${className}`}
      role="alert"
    >
      <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
        <AlertCircle className="size-5" />
      </div>
      <div className="space-y-1">
        {title ? (
          <p className="text-sm font-semibold text-slate-900">{displayTitle}</p>
        ) : null}
        <p className="text-sm text-destructive" role="alert">
          {displayMessage}
        </p>
      </div>
      {onRetry ? (
        <Button
          className="mt-1"
          onClick={onRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          {t.states.retry}
        </Button>
      ) : null}
    </div>
  );
}


