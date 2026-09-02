"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

type StatusBadgeProps = { value: string };

const destructiveStatuses = new Set(["BLOCKED", "CANCELLED", "ARCHIVED"]);
const secondaryStatuses = new Set(["PLANNED", "TODO", "ON_HOLD", "REVIEW"]);

export function StatusBadge({ value }: StatusBadgeProps) {
  const { t } = useI18n();
  const variant = destructiveStatuses.has(value)
    ? "destructive"
    : secondaryStatuses.has(value)
      ? "secondary"
      : "default";

  const label =
    value in t.status
      ? t.status[value as keyof typeof t.status]
      : value.replaceAll("_", " ");

  return <Badge variant={variant}>{label}</Badge>;
}

