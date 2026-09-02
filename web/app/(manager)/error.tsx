"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function ManagerError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="space-y-3 text-center">
        <h1 className="text-xl font-semibold">{t.states.errorTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {t.states.errorDesc}
        </p>
        <Button onClick={reset}>{t.states.retry}</Button>
      </div>
    </main>
  );
}

