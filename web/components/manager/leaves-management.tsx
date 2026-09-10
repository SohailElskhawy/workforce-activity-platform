"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteJson, patchJson, postJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";

type Leave = { id: string; employeeId: string; leaveType: string; startDate: Date | string; endDate: Date | string; status: string; notes: string | null; employee?: { firstName: string; lastName: string; email: string } };
type Employee = { id: string; firstName: string; lastName: string; email: string };
const statuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

export function LeavesManagement({ employees, leaves }: { employees: Employee[]; leaves: Leave[] }) {
  const router = useRouter();
  const { t, formatError, locale } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createLeave(form: FormData) {
    setBusy(true); setError(null);
    try {
      await postJson("/api/leaves", Object.fromEntries(form));
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? formatError(cause) : t.hr.saveLeaveFailed); }
    finally { setBusy(false); }
  }

  async function updateStatus(id: string, status: string) {
    setBusy(true); setError(null);
    try { await patchJson(`/api/leaves/${id}`, { status }); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? formatError(cause) : t.hr.updateLeaveFailed); }
    finally { setBusy(false); }
  }

  async function removeLeave(id: string) {
    if (!confirm(t.hr.deleteLeaveConfirm)) return;
    setBusy(true); setError(null);
    try { await deleteJson(`/api/leaves/${id}`); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? formatError(cause) : t.hr.deleteLeaveFailed); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6"><Card><CardHeader><CardTitle>{t.hr.addLeave}</CardTitle><CardDescription>{t.hr.addLeaveDesc}</CardDescription></CardHeader><CardContent><form action={createLeave} className="grid gap-3 md:grid-cols-2"><select className="h-9 rounded-md border bg-background px-3 text-sm" name="employeeId" required><option value="">{t.hr.selectEmployee}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} — {employee.email}</option>)}</select><Input name="leaveType" placeholder={t.hr.leaveType} required /><Input name="startDate" type="date" required /><Input name="endDate" type="date" required /><select className="h-9 rounded-md border bg-background px-3 text-sm" defaultValue="APPROVED" name="status">{statuses.map((status) => <option key={status}>{status}</option>)}</select><Input name="notes" placeholder={t.hr.optionalNote} /><div className="md:col-span-2"><Button disabled={busy} type="submit">{t.hr.addLeave}</Button></div></form>{error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}</CardContent></Card><Card><CardHeader><CardTitle>{t.hr.companyLeaveRecords}</CardTitle><CardDescription>{t.hr.companyLeaveRecordsDesc}</CardDescription></CardHeader><CardContent>{leaves.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">{t.common.employee}</th><th className="p-2">{t.hr.leaveType}</th><th className="p-2">{t.hr.startDate}</th><th className="p-2">{t.hr.status}</th><th className="p-2">{t.common.actions}</th></tr></thead><tbody>{leaves.map((leave) => <tr className="border-b" key={leave.id}><td className="p-2">{leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : leave.employeeId}</td><td className="p-2">{leave.leaveType}</td><td className="p-2">{new Date(leave.startDate).toLocaleDateString(locale)} – {new Date(leave.endDate).toLocaleDateString(locale)}</td><td className="p-2"><select className="h-8 rounded border bg-background px-2 text-xs" defaultValue={leave.status} disabled={busy} onChange={(event) => updateStatus(leave.id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td><td className="p-2"><Button disabled={busy} onClick={() => removeLeave(leave.id)} size="sm" type="button" variant="destructive">{t.common.delete}</Button></td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">{t.hr.noLeaveRecords}</p>}</CardContent></Card></div>;
}
