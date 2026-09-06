import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/breadcrumbs";

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  homeHref?: string;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({
  action,
  secondaryAction,
  badge,
  breadcrumbs,
  children,
  className = "",
  description,
  homeHref,
  title,
}: PageHeaderProps) {
  return (
    <header className={`space-y-4 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs homeHref={homeHref} items={breadcrumbs} />
      ) : null}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {badge ? <div className="inline-flex items-center">{badge}</div> : null}
          </div>
          {description ? (
            <div className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {description}
            </div>
          ) : null}
        </div>
        {action || secondaryAction ? (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {secondaryAction}
            {action}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
