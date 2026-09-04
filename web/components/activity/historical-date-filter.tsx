"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import { Calendar } from "lucide-react";

function DateFilterInner({ selectedDate }: { selectedDate: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("day", value);
    } else {
      params.delete("day");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <label htmlFor="historical-date-picker" className="font-medium text-muted-foreground">
        Date:
      </label>
      <input
        id="historical-date-picker"
        type="date"
        value={selectedDate}
        onChange={handleChange}
        disabled={isPending}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-opacity disabled:opacity-50"
      />
    </div>
  );
}

export function HistoricalDateFilter({ selectedDate }: { selectedDate: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">Date:</span>
          <input
            type="date"
            value={selectedDate}
            readOnly
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          />
        </div>
      }
    >
      <DateFilterInner selectedDate={selectedDate} />
    </Suspense>
  );
}
