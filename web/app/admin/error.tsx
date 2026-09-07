"use client";
import { DataError } from "@/components/states/data-error";
import { useI18n } from "@/lib/i18n";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="p-6">
      <DataError message={t.errors.generic} onRetry={reset} />
    </div>
  );
}
