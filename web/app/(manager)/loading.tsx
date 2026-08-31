import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerLoading() {
  return (
    <main className="flex-1 space-y-6 p-6 md:p-10">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <Skeleton className="h-28" key={item} />)}
      </div>
      <Skeleton className="h-72 w-full" />
    </main>
  );
}
