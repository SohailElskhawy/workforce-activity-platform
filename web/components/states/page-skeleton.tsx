import { Skeleton } from "@/components/ui/skeleton";

export type PageSkeletonProps = {
  variant?: "dashboard" | "detail" | "table";
};

export function TableSkeleton({
  columns = 5,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="w-full space-y-3 p-1">
      <div className="flex items-center gap-4 py-2 border-b border-slate-200">
        {Array.from({ length: columns }, (_, idx) => (
          <Skeleton
            className="h-4 flex-1"
            key={`header-${idx}`}
          />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <div
          className="flex items-center gap-4 py-3.5 border-b border-slate-100 last:border-0"
          key={`row-${rowIdx}`}
        >
          {Array.from({ length: columns }, (_, colIdx) => (
            <Skeleton
              className={`h-4 flex-1 ${colIdx === 0 ? "max-w-[180px]" : ""}`}
              key={`cell-${rowIdx}-${colIdx}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
          key={index}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-9 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ variant = "dashboard" }: PageSkeletonProps) {
  const rows = variant === "detail" ? 3 : variant === "table" ? 6 : 4;

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {variant === "dashboard" ? (
        <KpiGridSkeleton count={rows} />
      ) : null}
      <div className="space-y-3 rounded-xl border p-6">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton className="h-8 w-full" key={index} />
        ))}
      </div>
    </main>
  );
}

