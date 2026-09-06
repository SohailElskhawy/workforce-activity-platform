"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export type PriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type PriorityBadgeProps = {
  value: PriorityValue;
  className?: string;
};

export function PriorityBadge({ className = "", value }: PriorityBadgeProps) {
  const { t } = useI18n();
  const label = t.priority[value] ?? value;

  const config = {
    URGENT: {
      variant: "destructive" as const,
      icon: Flame,
      iconClass: "size-3 text-white",
    },
    HIGH: {
      variant: "destructive" as const,
      icon: ArrowUp,
      iconClass: "size-3 text-white",
    },
    MEDIUM: {
      variant: "outline" as const,
      icon: AlertTriangle,
      iconClass: "size-3 text-amber-500",
    },
    LOW: {
      variant: "outline" as const,
      icon: ArrowDown,
      iconClass: "size-3 text-slate-400",
    },
  }[value];

  const Icon = config.icon;

  return (
    <Badge
      className={`inline-flex items-center gap-1 font-medium ${className}`}
      variant={config.variant}
    >
      <Icon aria-hidden="true" className={config.iconClass} />
      <span>{label}</span>
    </Badge>
  );
}
