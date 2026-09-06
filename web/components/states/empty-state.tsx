import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({
  action,
  className = "",
  description,
  icon: Icon = Inbox,
  title,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-12 px-4 text-center ${className}`}
      role="status"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-slate-900">{title}</p>
        <p className="max-w-md text-sm text-slate-500 leading-relaxed">
          {description}
        </p>
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

