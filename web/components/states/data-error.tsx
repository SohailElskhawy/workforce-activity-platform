"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type DataErrorProps = {
  message?: string;
  onRetry?: () => void;
};

export function DataError({
  message,
  onRetry,
}: DataErrorProps) {
  const { t } = useI18n();
  const displayMessage = message ?? t.states.errorTitle;

  return (
    <div className="flex flex-col items-start gap-3 py-4">
      <p className="text-sm text-destructive" role="alert">
        {displayMessage}
      </p>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          {t.states.retry}
        </Button>
      ) : null}
    </div>
  );
}

