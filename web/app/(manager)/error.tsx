"use client";

import { Button } from "@/components/ui/button";

export default function ManagerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="space-y-3 text-center">
        <h1 className="text-xl font-semibold">Unable to load this workspace</h1>
        <p className="text-sm text-muted-foreground">Please try again. If the problem persists, contact an administrator.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
