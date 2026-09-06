import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({
  homeHref = "/dashboard",
  items,
}: {
  homeHref?: string;
  items: BreadcrumbItem[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <li className="inline-flex items-center">
          <Link
            aria-label="Home"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            href={homeHref}
          >
            <Home className="size-3.5" />
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li className="inline-flex items-center gap-1.5" key={`${item.label}-${index}`}>
              <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground/60" />
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-medium text-foreground" : "text-muted-foreground"}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  className="transition-colors hover:text-foreground"
                  href={item.href}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
