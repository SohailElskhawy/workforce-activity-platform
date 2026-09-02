"use client";

import { Button } from "@/components/ui/button";

type DataErrorProps = {
  message?: string;
  onRetry?: () => void;
};

export function DataError({ message = "Unable to load data.", onRetry }: DataErrorProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-4">
      <p className="text-sm text-destructive" role="alert">{message}</p>
      {onRetry ? <Button onClick={onRetry} size="sm" type="button" variant="outline">Retry</Button> : null}
    </div>
  );
}
