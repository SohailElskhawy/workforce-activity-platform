"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteJson, postJson } from "@/lib/client/api";

export type PositionOption = { id: string; name: string };

export function PositionManagement({ positions }: { positions: PositionOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createPosition(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/positions", { name });
      setName("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create position.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePosition(position: PositionOption) {
    if (!confirm(`Delete position "${position.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteJson(`/api/positions/${position.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete position.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Positions</CardTitle>
        <CardDescription>Company positions available for employee assignment.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={createPosition}>
          <Input aria-label="Position name" onChange={(event) => setName(event.target.value)} placeholder="e.g. Electrical Engineer" value={name} />
          <Button disabled={busy} type="submit"><Plus className="size-4" />Add</Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {positions.length ? (
          <ul className="divide-y rounded-md border">
            {positions.map((position) => (
              <li className="flex items-center justify-between gap-3 p-3 text-sm" key={position.id}>
                <span>{position.name}</span>
                <Button aria-label={`Delete ${position.name}`} disabled={busy} onClick={() => deletePosition(position)} size="icon" type="button" variant="ghost"><Trash2 className="size-4 text-destructive" /></Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No positions yet.</p>}
      </CardContent>
    </Card>
  );
}
