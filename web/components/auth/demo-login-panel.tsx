"use client";

import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { DatabaseZap, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ClientRequestError, postJson } from "@/lib/client/api";
import { getRoleHomeRoute } from "@/lib/auth-routes";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

type DemoAccount = {
  role: "SUPER_ADMIN" | "MANAGER" | "EMPLOYEE";
  email: string;
  label: string;
};

type DemoFixtureResult = {
  action: "seeded" | "reset";
  companies: number;
  users: number;
  employees: number;
  projects: number;
  tasks: number;
  activities: number;
  anomalies: number;
};

export function DemoLoginPanel({
  accounts,
  password,
}: {
  accounts: readonly DemoAccount[];
  password: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [busyAction, setBusyAction] = useState<"seed" | "reset" | "login" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  async function runFixtureAction(action: "seed" | "reset") {
    setBusyAction(action);
    try {
      const result = await postJson<DemoFixtureResult>(`/api/demo/${action}`, {});
      if (!result) throw new ClientRequestError(t.auth.demo.actionFailed);
      toast.success(
        t.auth.demo.seededSummary
          .replace("{companies}", String(result.companies))
          .replace("{employees}", String(result.employees))
          .replace("{projects}", String(result.projects)),
        action === "reset" ? t.auth.demo.resetComplete : t.auth.demo.seedComplete,
      );
      setConfirmReset(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t.auth.demo.actionFailed,
        t.common.error,
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function signInAs(account: DemoAccount) {
    setBusyAction("login");
    try {
      const result = await signIn("credentials", {
        email: account.email,
        password,
        redirect: false,
      });
      if (!result || result.error) throw new ClientRequestError(t.auth.invalidCredentials);
      const session = await getSession();
      const destination = getRoleHomeRoute(session?.user.role);
      if (!destination) throw new ClientRequestError(t.auth.invalidCredentials);
      window.location.assign(destination);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t.auth.invalidCredentials,
        t.common.error,
      );
      setBusyAction(null);
    }
  }

  return (
    <section className="mt-6 grid gap-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4" aria-label={t.auth.demo.title}>
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
          <ShieldCheck className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{t.auth.demo.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{t.auth.demo.description}</p>
        </div>
      </div>
      <div className="grid min-w-0 gap-2 md:grid-cols-3">
        {accounts.map((account) => (
          <Button
            className="h-auto min-h-9 w-full min-w-0 whitespace-normal px-2 py-2 text-center leading-tight"
            key={account.role}
            disabled={busyAction !== null}
            onClick={() => void signInAs(account)}
            size="sm"
            type="button"
            variant="outline"
          >
            {busyAction === "login" ? <LoaderCircle className="animate-spin" /> : null}
            {t.auth.demo.signInAs.replace("{role}", account.label)}
          </Button>
        ))}
      </div>
      <Separator />
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <Button className="h-auto min-h-9 w-full min-w-0 whitespace-normal py-2 leading-tight" disabled={busyAction !== null} onClick={() => void runFixtureAction("seed")} size="sm" type="button">
          {busyAction === "seed" ? <LoaderCircle className="animate-spin" /> : <DatabaseZap />}
          {t.auth.demo.seed}
        </Button>
        <Button className="h-auto min-h-9 w-full min-w-0 whitespace-normal py-2 leading-tight" disabled={busyAction !== null} onClick={() => setConfirmReset(true)} size="sm" type="button" variant="outline">
          <RotateCcw />
          {t.auth.demo.reset}
        </Button>
      </div>
      <ConfirmationDialog
        confirmLabel={t.auth.demo.reset}
        description={t.auth.demo.resetDescription}
        isSubmitting={busyAction === "reset"}
        onConfirm={() => runFixtureAction("reset")}
        onOpenChange={setConfirmReset}
        open={confirmReset}
        title={t.auth.demo.resetTitle}
      />
    </section>
  );
}
