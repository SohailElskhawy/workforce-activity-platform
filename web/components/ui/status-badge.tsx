"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export type StatusBadgeProps = {
  value: string;
  className?: string;
};

const destructiveStatuses = new Set([
  "BLOCKED",
  "CANCELLED",
  "ARCHIVED",
  "SUSPENDED",
  "INACTIVE",
  "OVERDUE",
]);

const secondaryStatuses = new Set([
  "PLANNED",
  "TODO",
  "ON_HOLD",
  "REVIEW",
  "OFFLINE",
  "DUE_SOON",
]);

const successStatuses = new Set([
  "ACTIVE",
  "COMPLETED",
  "IN_PROGRESS",
  "ONLINE",
]);

export function StatusBadge({ className = "", value }: StatusBadgeProps) {
  const { t } = useI18n();

  const isDestructive = destructiveStatuses.has(value);
  const isSecondary = secondaryStatuses.has(value);
  const isSuccess = successStatuses.has(value);

  const variant = isDestructive
    ? "destructive"
    : isSecondary
      ? "secondary"
      : "default";

  const dotClass = isDestructive
    ? "bg-rose-500"
    : isSecondary
      ? "bg-amber-500"
      : isSuccess
        ? "bg-emerald-400"
        : "bg-slate-400";

  const label =
    value in t.status
      ? t.status[value as keyof typeof t.status]
      : value.replaceAll("_", " ");

  return (
    <Badge className={`inline-flex items-center gap-1.5 ${className}`} variant={variant}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </Badge>
  );
}
