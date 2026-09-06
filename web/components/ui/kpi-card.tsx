import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type KpiTone = "default" | "emerald" | "violet" | "amber" | "sky" | "rose";

export type KpiCardProps = {
  label: string;
  value: string | number;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  badge?: ReactNode;
  trend?: {
    value: string;
    positive?: boolean;
  };
  className?: string;
};

const toneStyles: Record<KpiTone, string> = {
  default: "bg-slate-100 text-slate-700",
  emerald: "bg-emerald-50 text-emerald-700",
  violet: "bg-violet-50 text-violet-700",
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
  rose: "bg-rose-50 text-rose-700",
};

export function KpiCard({
  badge,
  className = "",
  description,
  icon: Icon,
  label,
  tone = "default",
  trend,
  value,
}: KpiCardProps) {
  const iconToneClass = toneStyles[tone] ?? toneStyles.default;

  return (
    <Card className={`border-slate-200 shadow-sm transition-all ${className}`}>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div className="min-w-0 flex-1">
          <CardDescription className="text-xs font-medium text-slate-500 truncate">
            {label}
          </CardDescription>
          <CardTitle className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            {value}
          </CardTitle>
        </div>
        {badge ? (
          <div className="shrink-0">{badge}</div>
        ) : Icon ? (
          <span
            aria-hidden="true"
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10 ${iconToneClass}`}
          >
            <Icon className="size-4 sm:size-5" />
          </span>
        ) : null}
      </CardHeader>
      {description || trend ? (
        <CardContent className="pt-0 text-xs text-slate-500">
          {trend ? (
            <span
              className={`mr-1.5 font-medium ${
                trend.positive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {trend.value}
            </span>
          ) : null}
          {description}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function KpiGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {children}
    </section>
  );
}
