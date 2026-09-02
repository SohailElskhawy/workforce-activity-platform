"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

type PriorityBadgeProps = { value: "LOW" | "MEDIUM" | "HIGH" | "URGENT" };

export function PriorityBadge({ value }: PriorityBadgeProps) {
  const { t } = useI18n();
  const label = t.priority[value] ?? value;

  return (
    <Badge
      variant={
        value === "URGENT" || value === "HIGH" ? "destructive" : "outline"
      }
    >
      {label}
    </Badge>
  );
}

