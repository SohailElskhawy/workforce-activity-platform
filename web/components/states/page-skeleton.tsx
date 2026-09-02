import { Skeleton } from "@/components/ui/skeleton";

type PageSkeletonProps = {
  variant?: "dashboard" | "detail" | "table";
};

export function PageSkeleton({ variant = "dashboard" }: PageSkeletonProps) {
  const rows = variant === "detail" ? 3 : variant === "table" ? 6 : 4;

  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <div className="space-y-2"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-80" /></div>
      {variant === "dashboard" ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: rows }, (_, index) => <Skeleton className="h-28" key={index} />)}</div> : null}
      <div className="space-y-3 rounded-xl border p-6">{Array.from({ length: rows }, (_, index) => <Skeleton className="h-8 w-full" key={index} />)}</div>
    </main>
  );
}
