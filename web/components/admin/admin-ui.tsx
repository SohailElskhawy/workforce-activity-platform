"use client";

import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  DataTable,
  TablePagination,
  type ColumnDef,
} from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { FormAlert } from "@/components/ui/form-dialog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { DataError } from "@/components/states/data-error";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import type { TranslationDictionary } from "@/lib/i18n/types";
import type {
  listAdminCompanies,
  listAdminUsers,
  listAdminLogs,
  getAdminCompany,
  adminOverview,
} from "@/lib/admin/service";
import { CompanyFilter } from "./company-filter";

type Company = Awaited<ReturnType<typeof listAdminCompanies>>["items"][number];
type User = Awaited<ReturnType<typeof listAdminUsers>>["items"][number];
type Log = Awaited<ReturnType<typeof listAdminLogs>>["items"][number];
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
type Role = User["role"];
const roles: Role[] = ["SUPER_ADMIN", "MANAGER", "EMPLOYEE"];
function errorText(code: string, t: TranslationDictionary) {
  if (code === "VALIDATION_ERROR") return t.admin.invalid;
  if (code === "CONFLICT") return t.admin.conflict;
  if (code === "NOT_FOUND") return t.admin.notFound;
  if (["UNAUTHORIZED", "FORBIDDEN"].includes(code)) return t.admin.unauthorized;
  return t.errors.generic;
}
function useAdminData<T>(url: string) {
  const [state, setState] = useState<{ url: string; data?: T; error?: string }>(
    { url: "" },
  );
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error?.code ?? "INTERNAL_ERROR");
        setState({ url, data: result.data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ url, error: error.message });
      });
    return () => controller.abort();
  }, [url, version]);
  return {
    data: state.url === url ? state.data : undefined,
    error: state.url === url ? state.error : undefined,
    reload: () => {
      setState({ url: "" });
      setVersion((v) => v + 1);
    },
  };
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
function roleLabel(role: Role, t: TranslationDictionary) {
  return role === "SUPER_ADMIN"
    ? t.admin.superAdmin
    : role === "MANAGER"
      ? t.common.manager
      : t.common.employee;
}
function Frame({
  title,
  children,
  action,
  description,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  description?: string;
}) {
  const { t } = useI18n();
  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-10">
      <PageHeader
        title={title}
        description={description ?? t.admin.subtitle}
        badge={<Badge variant="secondary">{t.admin.superAdmin}</Badge>}
        homeHref="/admin"
        breadcrumbs={[
          { label: t.admin.workspace, href: "/admin" },
          { label: title },
        ]}
        action={action}
      />
      {children}
    </main>
  );
}
function CompanyPicker({
  value,
  name,
  onChange,
  optional = false,
}: {
  value: string;
  name?: string;
  onChange: (id: string, name: string) => void;
  optional?: boolean;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const state = useAdminData<Page<Company>>(
    `/api/admin/companies?${new URLSearchParams({ q, page: String(page), pageSize: "10" })}`,
  );
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Field label={t.admin.company}>
        <Input
          type="search"
          value={q}
          placeholder={t.common.search}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </Field>
      <p className="text-xs text-muted-foreground">{t.admin.companyHelp}</p>
      <select
        aria-label={t.admin.chooseCompany}
        required={!optional}
        className={selectClass}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value,
            state.data?.items.find((c) => c.id === e.target.value)?.name ?? "",
          )
        }
      >
        <option value="">
          {optional ? t.admin.allCompanies : t.admin.chooseCompany}
        </option>
        {value && !state.data?.items.some((c) => c.id === value) && (
          <option value={value}>{name || value}</option>
        )}
        {state.data?.items.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.id.slice(0, 8)}
          </option>
        ))}
      </select>
      {state.error ? (
        <DataError message={errorText(state.error, t)} onRetry={state.reload} />
      ) : !state.data ? (
        <p role="status">{t.common.loading}</p>
      ) : (
        <>
          <p className="text-xs">
            {t.admin.total}: {state.data.total}
          </p>
          <TablePagination {...state.data} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
function CompanyForm({
  company,
  close,
  saved,
}: {
  company?: Company;
  close: () => void;
  saved: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(company?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/admin/companies${company ? `/${company.id}` : ""}`,
        {
          method: company ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.code);
      toast.success(t.admin.saved);
      saved();
      close();
      if (!company) router.push(`/admin/companies/${result.data.id}`);
    } catch (error) {
      setError(errorText(error instanceof Error ? error.message : "", t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogTitle>
          {company ? t.common.edit : t.admin.newCompany}
        </DialogTitle>
        <DialogDescription>{t.admin.companyNameHelp}</DialogDescription>
        <form className="grid gap-4" onSubmit={submit}>
          <Field label={t.admin.name}>
            <Input
              required
              minLength={2}
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <FormAlert message={error} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              {t.common.cancel}
            </Button>
            <Button disabled={busy}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function UserForm({
  user,
  close,
  saved,
}: {
  user?: User;
  close: () => void;
  saved: (email: string) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [role, setRole] = useState<Role>(user?.role ?? "MANAGER");
  const [company, setCompany] = useState({
    id: user?.companyId ?? "",
    name: user?.company.name ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const data = new FormData(e.currentTarget);
    const body = {
      companyId: company.id,
      role,
      ...(!user
        ? {
            email: data.get("email"),
            temporaryPassword: data.get("password"),
            ...(role === "EMPLOYEE"
              ? {
                  firstName: data.get("firstName"),
                  lastName: data.get("lastName"),
                }
              : {}),
          }
        : {}),
    };
    try {
      const response = await fetch(
        `/api/admin/users${user ? `/${user.id}` : ""}`,
        {
          method: user ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.code);
      toast.success(t.admin.saved);
      saved(result.data.email);
      close();
    } catch (error) {
      setError(errorText(error instanceof Error ? error.message : "", t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
      >
        <DialogTitle>
          {user ? `${t.common.edit}: ${user.email}` : t.admin.newUser}
        </DialogTitle>
        <DialogDescription>{t.admin.userHelp}</DialogDescription>
        <form className="grid gap-4" onSubmit={submit}>
          <CompanyPicker
            value={company.id}
            name={company.name}
            onChange={(id, name) => setCompany({ id, name })}
          />
          <Field label={t.admin.role}>
            <select
              className={selectClass}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r, t)}
                </option>
              ))}
            </select>
          </Field>
          {!user && (
            <>
              <Field label={t.employees.email}>
                <Input
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  autoComplete="off"
                />
              </Field>
              <Field label={t.employees.temporaryPassword}>
                <Input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                {t.admin.passwordHelp}
              </p>
              {role === "EMPLOYEE" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t.employees.firstName}>
                    <Input name="firstName" required maxLength={80} />
                  </Field>
                  <Field label={t.employees.lastName}>
                    <Input name="lastName" required maxLength={80} />
                  </Field>
                </div>
              )}
            </>
          )}
          <FormAlert message={error} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              {t.common.cancel}
            </Button>
            <Button disabled={busy || !company.id}>
              {busy ? t.common.saving : t.common.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function AdminCompanies() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Company | "new" | null>(null);
  const state = useAdminData<Page<Company>>(
    `/api/admin/companies?${new URLSearchParams({ q, page: String(page) })}`,
  );
  const columns: ColumnDef<Company>[] = [
    {
      header: t.admin.name,
      cell: (c) => (
        <Link
          className="font-semibold underline"
          href={`/admin/companies/${c.id}`}
        >
          {c.name}
        </Link>
      ),
    },
    ...(["users", "employees", "projects", "devices"] as const).map((key) => ({
      header: key === "users" ? t.admin.users : t.common.navigation[key],
      cell: (c: Company) => c._count[key],
    })),
    {
      header: t.admin.createdAt,
      cell: (c) => new Date(c.createdAt).toLocaleDateString(locale),
    },
    {
      header: t.common.actions,
      cell: (c) => (
        <Button variant="outline" size="sm" onClick={() => setEdit(c)}>
          {t.common.edit}
        </Button>
      ),
    },
  ];
  return (
    <Frame
      title={t.admin.companies}
      action={
        <Button onClick={() => setEdit("new")}>{t.admin.newCompany}</Button>
      }
    >
      <FilterBar>
        <Field label={t.common.search}>
          <Input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </Field>
      </FilterBar>
      <DataTable
        columns={columns}
        data={state.data?.items ?? []}
        isLoading={!state.data && !state.error}
        error={state.error ? errorText(state.error, t) : undefined}
        onRetry={state.reload}
        emptyTitle={t.admin.empty}
        emptyDescription={t.admin.emptyDesc}
        pagination={
          state.data ? { ...state.data, onPageChange: setPage } : undefined
        }
      />
      {edit && (
        <CompanyForm
          company={edit === "new" ? undefined : edit}
          close={() => setEdit(null)}
          saved={() => {
            setQ("");
            setPage(1);
            state.reload();
          }}
        />
      )}
    </Frame>
  );
}
export function AdminUsers({ companyId = "" }: { companyId?: string }) {
  const { t } = useI18n();
  const [filters, setFilters] = useState({ q: "", companyId, role: "" });
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<User | "new" | null>(null);
  const state = useAdminData<Page<User>>(
    `/api/admin/users?${new URLSearchParams({ ...filters, page: String(page) })}`,
  );
  const filter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const columns: ColumnDef<User>[] = [
    { header: t.employees.email, accessorKey: "email" },
    {
      header: t.admin.name,
      cell: (u) =>
        u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : "—",
    },
    {
      header: t.admin.role,
      cell: (u) => <Badge variant="secondary">{roleLabel(u.role, t)}</Badge>,
    },
    {
      header: t.admin.company,
      cell: (u) => (
        <Link className="underline" href={`/admin/companies/${u.companyId}`}>
          {u.company.name}
        </Link>
      ),
    },
    {
      header: t.common.actions,
      cell: (u) => (
        <Button variant="outline" size="sm" onClick={() => setEdit(u)}>
          {t.common.edit}
        </Button>
      ),
    },
  ];
  return (
    <Frame
      title={t.admin.users}
      action={<Button onClick={() => setEdit("new")}>{t.admin.newUser}</Button>}
    >
      <FilterBar>
        <Field label={t.common.search}>
          <Input
            type="search"
            value={filters.q}
            onChange={(e) => filter("q", e.target.value)}
          />
        </Field>
        <Field label={t.admin.role}>
          <select
            className={selectClass}
            value={filters.role}
            onChange={(e) => filter("role", e.target.value)}
          >
            <option value="">{t.common.all}</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r, t)}
              </option>
            ))}
          </select>
        </Field>
        <CompanyFilter
          value={filters.companyId}
          onChange={(id) => filter("companyId", id)}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setFilters({ q: "", companyId: "", role: "" });
            setPage(1);
          }}
        >
          {t.common.clearFilters}
        </Button>
      </FilterBar>
      <DataTable
        columns={columns}
        data={state.data?.items ?? []}
        isLoading={!state.data && !state.error}
        error={state.error ? errorText(state.error, t) : undefined}
        onRetry={state.reload}
        emptyTitle={t.admin.empty}
        emptyDescription={t.admin.emptyDesc}
        pagination={
          state.data ? { ...state.data, onPageChange: setPage } : undefined
        }
      />
      {edit && (
        <UserForm
          user={edit === "new" ? undefined : edit}
          close={() => setEdit(null)}
          saved={(email) => {
            setFilters({ q: email, companyId: "", role: "" });
            setPage(1);
            state.reload();
          }}
        />
      )}
    </Frame>
  );
}
function LogTable({
  data,
  error,
  reload,
  onPageChange,
}: {
  data?: Page<Log>;
  error?: string;
  reload?: () => void;
  onPageChange?: (page: number) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <DataTable
      columns={[
        {
          header: t.activities.timestamp,
          cell: (r: Log) => new Date(r.createdAt).toLocaleString(locale),
        },
        { header: t.admin.company, cell: (r) => r.company.name },
        { header: t.admin.actor, cell: (r) => r.actor?.email ?? "—" },
        { header: t.admin.action, accessorKey: "action" },
        { header: t.admin.entityType, accessorKey: "entityType" },
        { header: t.admin.entityId, accessorKey: "entityId" },
        {
          header: t.admin.details,
          cell: (r) =>
            Object.keys(r.metadata).length ? (
              <details>
                <summary className="cursor-pointer">{t.common.view}</summary>
                <pre className="max-w-xs overflow-auto text-xs">
                  {JSON.stringify(r.metadata, null, 2)}
                </pre>
              </details>
            ) : (
              "—"
            ),
        },
      ]}
      data={data?.items ?? []}
      isLoading={!data && !error}
      error={error ? errorText(error, t) : undefined}
      onRetry={reload}
      emptyTitle={t.admin.empty}
      emptyDescription={t.admin.emptyDesc}
      pagination={data && onPageChange ? { ...data, onPageChange } : undefined}
    />
  );
}
export function AdminLogs() {
  const { t } = useI18n();
  const initial = {
    companyId: "",
    actor: "",
    action: "",
    entityType: "",
    from: "",
    to: "",
  };
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1);
  const state = useAdminData<Page<Log>>(
    `/api/admin/system-logs?${new URLSearchParams({ ...filters, page: String(page) })}`,
  );
  const filter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  return (
    <Frame title={t.admin.logs} description={t.admin.logHelp}>
      <FilterBar>
        {(["actor", "action", "entityType", "from", "to"] as const).map(
          (key) => (
            <Field key={key} label={t.admin[key]}>
              <Input
                type={key === "from" || key === "to" ? "date" : "search"}
                value={filters[key]}
                onChange={(e) => filter(key, e.target.value)}
              />
            </Field>
          ),
        )}
        <CompanyFilter
          value={filters.companyId}
          onChange={(id) => filter("companyId", id)}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setFilters(initial);
            setPage(1);
          }}
        >
          {t.common.clearFilters}
        </Button>
      </FilterBar>
      <LogTable {...state} onPageChange={setPage} />
    </Frame>
  );
}
export function AdminOverview() {
  const { t } = useI18n();
  const state =
    useAdminData<Awaited<ReturnType<typeof adminOverview>>>("/api/admin");
  return (
    <Frame title={t.admin.overview}>
      {state.error ? (
        <DataError message={errorText(state.error, t)} onRetry={state.reload} />
      ) : !state.data ? (
        <PageSkeleton variant="dashboard" />
      ) : (
        <>
          <KpiGrid>
            {(
              [
                "companies",
                "users",
                "employees",
                "projects",
                "devices",
                "activeDevices",
                "activeCompanies",
              ] as const
            ).map((key) => (
              <KpiCard
                key={key}
                label={
                  key === "employees" || key === "projects" || key === "devices"
                    ? t.common.navigation[key]
                    : t.admin[key]
                }
                value={state.data![key]}
              />
            ))}
          </KpiGrid>
          <h2 className="text-lg font-semibold">{t.admin.recent}</h2>
          <LogTable
            data={{
              items: state.data.recent,
              total: state.data.recent.length,
              page: 1,
              pageSize: 10,
            }}
          />
          <Link className="text-sm underline" href="/admin/system-logs">
            {t.common.viewAll}
          </Link>
        </>
      )}
    </Frame>
  );
}
export function AdminCompany({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const state = useAdminData<Awaited<ReturnType<typeof getAdminCompany>>>(
    `/api/admin/companies/${id}`,
  );
  const [edit, setEdit] = useState(false);
  const company = state.data;
  return (
    <Frame
      title={company?.name ?? t.admin.company}
      action={
        company && (
          <Button onClick={() => setEdit(true)}>{t.common.edit}</Button>
        )
      }
    >
      {state.error ? (
        <DataError message={errorText(state.error, t)} onRetry={state.reload} />
      ) : !company ? (
        <PageSkeleton variant="detail" />
      ) : (
        <>
          <p className="break-all text-xs text-muted-foreground">
            {company.id} · {t.admin.createdAt}:{" "}
            {new Date(company.createdAt).toLocaleString(locale)} ·{" "}
            {t.admin.updatedAt}:{" "}
            {new Date(company.updatedAt).toLocaleString(locale)}
          </p>
          <KpiGrid>
            {(["users", "employees", "projects", "devices"] as const).map(
              (key) => (
                <KpiCard
                  key={key}
                  label={
                    key === "users" ? t.admin.users : t.common.navigation[key]
                  }
                  value={company._count[key]}
                />
              ),
            )}
          </KpiGrid>
          <Link
            className="inline-block font-medium underline"
            href={`/admin/users?companyId=${id}`}
          >
            {t.admin.viewUsers}
          </Link>
          <section className="space-y-3 rounded-xl border bg-white p-5">
            <h2 className="font-semibold">{t.admin.tracking}</h2>
            {company.trackingSettings ? (
              <>
                <p>
                  {t.settings.idleThresholdCard.idleThresholdLabel}:{" "}
                  {company.trackingSettings.idleThresholdSeconds}{" "}
                  {t.settings.idleThresholdCard.secondsLabel}
                </p>
                <p>
                  {t.settings.agentConfigCard.configVersionLabel}:{" "}
                  {company.trackingSettings.configVersion}
                </p>
              </>
            ) : (
              <p>{t.admin.defaultTracking}</p>
            )}
            <p>
              {t.admin.exclusions}: {company._count.excludedApplications}
            </p>
          </section>
          <section className="space-y-3 rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t.admin.integrations}</h2>
              <Link
                className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                href={`/admin/integrations?companyId=${id}`}
              >
                {t.admin.manage}
              </Link>
            </div>
            {company.integrations && company.integrations.length > 0 ? (
              <div className="divide-y rounded-lg border">
                {company.integrations.map((integ) => (
                  <div
                    key={integ.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {integ.provider === "CLICKUP"
                            ? t.integrationsSection.providerClickUp
                            : integ.provider === "CLOCKIFY"
                              ? t.integrationsSection.providerClockify
                              : t.integrationsSection.providerKolayIk}
                        </span>
                        <Badge
                          variant={
                            integ.status === "CONNECTED"
                              ? "default"
                              : integ.status === "ERROR"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {integ.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.integrationsSection.lastSyncLabel}:{" "}
                        {integ.lastSyncAt
                          ? new Date(integ.lastSyncAt).toLocaleString(locale)
                          : t.integrationsSection.neverSynced}
                      </p>
                      {integ.lastError && (
                        <p className="text-xs text-red-600 mt-0.5">
                          {integ.lastError}
                        </p>
                      )}
                    </div>
                    <Link
                      className="text-xs font-medium text-slate-700 hover:underline"
                      href={`/admin/integrations?companyId=${id}&provider=${integ.provider}`}
                    >
                      {t.admin.manage} &rarr;
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">
                  {t.admin.noIntegrations}
                </p>
                <Link
                  className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
                  href={`/admin/integrations?companyId=${id}`}
                >
                  {t.admin.configureIntegration} &rarr;
                </Link>
              </div>
            )}
          </section>
          {edit && (
            <CompanyForm
              company={company}
              close={() => setEdit(false)}
              saved={state.reload}
            />
          )}
        </>
      )}
    </Frame>
  );
}
export function AdminInformation({
  section,
}: {
  section: "settings" | "integrations";
}) {
  const { t } = useI18n();
  const state = useAdminData<{ sessionHours?: number }>(
    `/api/admin/${section}`,
  );
  return (
    <Frame title={t.admin[section]}>
      {state.error ? (
        <DataError message={errorText(state.error, t)} onRetry={state.reload} />
      ) : !state.data ? (
        <PageSkeleton />
      ) : (
        <section className="space-y-5 rounded-xl border bg-white p-6">
          <Badge variant="secondary">{t.admin.readonly}</Badge>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {section === "settings"
              ? t.admin.noSettings
              : t.admin.noIntegrations}
          </p>
          {section === "settings" && (
            <>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold">{t.admin.auth}</dt>
                  <dd>{t.admin.credentials}</dd>
                </div>
                <div>
                  <dt className="font-semibold">{t.admin.session}</dt>
                  <dd>
                    {state.data.sessionHours} {t.admin.hours}
                  </dd>
                </div>
              </dl>
              <Link className="text-sm underline" href="/admin/companies">
                {t.admin.companies}
              </Link>
            </>
          )}
        </section>
      )}
    </Frame>
  );
}

export function AdminSettings() {
  const { t } = useI18n();
  const { toast } = useToast();
  const state = useAdminData<{
    globalSettingsAvailable: boolean;
    notificationDueSoonHours: number;
    defaultIdleThresholdSeconds: number;
    sessionHours: number;
    authentication: string;
    trackingScope: string;
  }>("/api/admin/settings");

  const [notificationDueSoonHours, setNotificationDueSoonHours] = useState<number>(24);
  const [defaultIdleThresholdSeconds, setDefaultIdleThresholdSeconds] = useState<number>(300);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (state.data) {
      if (typeof state.data.notificationDueSoonHours === "number") {
        setNotificationDueSoonHours(state.data.notificationDueSoonHours);
      }
      if (typeof state.data.defaultIdleThresholdSeconds === "number") {
        setDefaultIdleThresholdSeconds(state.data.defaultIdleThresholdSeconds);
      }
    }
  }, [state.data]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationDueSoonHours: Number(notificationDueSoonHours),
          defaultIdleThresholdSeconds: Number(defaultIdleThresholdSeconds),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || t.errors.unableToSave);
      }
      toast({
        title: t.common.save,
        description: t.admin.saved,
        variant: "default",
      });
      state.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Frame title={t.admin.settings}>
      {state.error ? (
        <DataError message={errorText(state.error, t)} onRetry={state.reload} />
      ) : !state.data ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-6">
          <section className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t.admin.systemSettings}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.admin.noSettings}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
              {formError && <FormAlert message={formError} />}

              <Field label={t.admin.notificationDueSoonLabel}>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={notificationDueSoonHours}
                  onChange={(e) => setNotificationDueSoonHours(Number(e.target.value))}
                  required
                />
                <span className="text-xs text-muted-foreground">
                  Range: 1–168 hours (default: 24).
                </span>
              </Field>

              <Field label={t.admin.defaultIdleThresholdLabel}>
                <Input
                  type="number"
                  min={60}
                  max={1800}
                  value={defaultIdleThresholdSeconds}
                  onChange={(e) => setDefaultIdleThresholdSeconds(Number(e.target.value))}
                  required
                />
                <span className="text-xs text-muted-foreground">
                  Range: 60–1800 seconds (default: 300).
                </span>
              </Field>

              <Button type="submit" disabled={saving}>
                {saving ? t.common.loading : t.admin.saveSettings}
              </Button>
            </form>
          </section>

          <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {t.admin.readonly}
              </h2>
              <Badge variant="secondary">{t.admin.readonly}</Badge>
            </div>
            <dl className="grid gap-3 text-sm max-w-xl">
              <div>
                <dt className="font-semibold">{t.admin.auth}</dt>
                <dd>{t.admin.credentials}</dd>
              </div>
              <div>
                <dt className="font-semibold">{t.admin.session}</dt>
                <dd>
                  {state.data.sessionHours} {t.admin.hours}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </Frame>
  );
}

type AdminIntegrationItem = {
  id: string;
  companyId: string;
  companyName: string;
  provider: "CLICKUP" | "CLOCKIFY" | "KOLAY_IK";
  status: "NOT_CONFIGURED" | "CONFIGURED" | "CONNECTED" | "ERROR" | "SYNCING" | "DISABLED";
  isConfigured: boolean;
  config: Record<string, unknown> | null;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export function AdminIntegrations({
  companyId = "",
  provider = "",
}: {
  companyId?: string;
  provider?: string;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    q: "",
    companyId,
    provider,
    status: "",
  });
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Configure modal form state
  const [modalCompanyId, setModalCompanyId] = useState("");
  const [modalCompanyName, setModalCompanyName] = useState("");
  const [modalProvider, setModalProvider] = useState<"CLICKUP" | "CLOCKIFY" | "KOLAY_IK">("CLICKUP");
  const [apiToken, setApiToken] = useState("");
  const [listId, setListId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const queryParams = new URLSearchParams();
  if (filters.q) queryParams.set("q", filters.q);
  if (filters.companyId) queryParams.set("companyId", filters.companyId);
  if (filters.provider) queryParams.set("provider", filters.provider);
  if (filters.status) queryParams.set("status", filters.status);
  queryParams.set("page", String(page));
  queryParams.set("pageSize", "10");

  const state = useAdminData<Page<AdminIntegrationItem>>(
    `/api/admin/integrations?${queryParams.toString()}`
  );

  const filter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleTest = async (item: AdminIntegrationItem) => {
    const actionKey = `test-${item.id}`;
    setActionLoading(actionKey);
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TEST",
          companyId: item.companyId,
          provider: item.provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Test failed");
      }
      toast({
        title: t.admin.testConnection,
        description: data.data?.message || t.common.save,
        variant: "default",
      });
      state.reload();
    } catch (err) {
      toast({
        title: t.admin.testConnection,
        description: err instanceof Error ? err.message : t.errors.generic,
        variant: "destructive",
      });
      state.reload();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSync = async (item: AdminIntegrationItem) => {
    const actionKey = `sync-${item.id}`;
    setActionLoading(actionKey);
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SYNC",
          companyId: item.companyId,
          provider: item.provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Sync failed");
      }
      toast({
        title: t.admin.sync,
        description: t.common.save,
        variant: "default",
      });
      state.reload();
    } catch (err) {
      toast({
        title: t.admin.sync,
        description: err instanceof Error ? err.message : t.errors.generic,
        variant: "destructive",
      });
      state.reload();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (item: AdminIntegrationItem) => {
    const actionKey = `disconnect-${item.id}`;
    setActionLoading(actionKey);
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DISCONNECT",
          companyId: item.companyId,
          provider: item.provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Disconnect failed");
      }
      toast({
        title: t.admin.disconnect,
        description: t.common.save,
        variant: "default",
      });
      state.reload();
    } catch (err) {
      toast({
        title: t.admin.disconnect,
        description: err instanceof Error ? err.message : t.errors.generic,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openConfigure = (presetCompanyId?: string, presetCompanyName?: string, presetProvider?: "CLICKUP" | "CLOCKIFY" | "KOLAY_IK") => {
    setModalCompanyId(presetCompanyId || filters.companyId || "");
    setModalCompanyName(presetCompanyName || "");
    setModalProvider(presetProvider || "CLICKUP");
    setApiToken("");
    setListId("");
    setApiKey("");
    setWorkspaceId("");
    setApiBaseUrl("");
    setModalError(null);
    setDialogOpen(true);
  };

  const handleSaveConfigure = async (e: FormEvent) => {
    e.preventDefault();
    if (!modalCompanyId) {
      setModalError(t.admin.companyHelp);
      return;
    }
    setModalError(null);
    setSubmitting(true);
    try {
      let credentials: Record<string, unknown> = {};
      let config: Record<string, unknown> = {};

      if (modalProvider === "CLICKUP") {
        credentials = { apiToken };
        config = { listId };
      } else if (modalProvider === "CLOCKIFY") {
        credentials = { apiKey };
        config = { workspaceId };
      } else if (modalProvider === "KOLAY_IK") {
        credentials = { apiToken };
        config = { apiBaseUrl };
      }

      const res = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIGURE",
          companyId: modalCompanyId,
          provider: modalProvider,
          credentials,
          config,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || t.errors.unableToSave);
      }
      toast({
        title: t.admin.configureIntegration,
        description: t.admin.saved,
        variant: "default",
      });
      setDialogOpen(false);
      state.reload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<AdminIntegrationItem>[] = [
    {
      header: t.admin.company,
      cell: (item) => (
        <Link className="font-medium underline" href={`/admin/companies/${item.companyId}`}>
          {item.companyName}
        </Link>
      ),
    },
    {
      header: t.admin.integrations,
      cell: (item) => (
        <span className="font-medium text-sm">
          {item.provider === "CLICKUP"
            ? t.integrationsSection.providerClickUp
            : item.provider === "CLOCKIFY"
              ? t.integrationsSection.providerClockify
              : t.integrationsSection.providerKolayIk}
        </span>
      ),
    },
    {
      header: t.admin.role,
      cell: (item) => (
        <Badge
          variant={
            item.status === "CONNECTED"
              ? "default"
              : item.status === "ERROR"
                ? "destructive"
                : item.status === "CONFIGURED"
                  ? "outline"
                  : "secondary"
          }
        >
          {item.status}
        </Badge>
      ),
    },
    {
      header: t.integrationsSection.lastSyncLabel,
      cell: (item) => (
        <span className="text-xs text-muted-foreground">
          {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString(locale) : t.integrationsSection.neverSynced}
        </span>
      ),
    },
    {
      header: t.admin.details,
      cell: (item) => (
        <div className="max-w-xs text-xs">
          {item.lastError ? (
            <span className="text-red-600 block truncate" title={item.lastError}>
              {item.lastError}
            </span>
          ) : item.config && Object.keys(item.config).length > 0 ? (
            <span className="text-muted-foreground block truncate">
              {Object.entries(item.config)
                .filter(([, v]) => v !== undefined && v !== null && v !== "")
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      header: t.common.actions,
      cell: (item) => {
        const isTesting = actionLoading === `test-${item.id}`;
        const isSyncing = actionLoading === `sync-${item.id}`;
        const isDisconnecting = actionLoading === `disconnect-${item.id}`;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(actionLoading)}
              onClick={() => handleTest(item)}
            >
              {isTesting ? t.common.loading : t.admin.testConnection}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(actionLoading)}
              onClick={() => handleSync(item)}
            >
              {isSyncing ? t.common.loading : t.admin.sync}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              disabled={Boolean(actionLoading)}
              onClick={() => handleDisconnect(item)}
            >
              {isDisconnecting ? t.common.loading : t.admin.disconnect}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Frame
      title={t.admin.integrations}
      action={<Button onClick={() => openConfigure()}>{t.admin.configureIntegration}</Button>}
    >
      <FilterBar>
        <Input
          type="search"
          placeholder={t.common.search}
          value={filters.q}
          onChange={(e) => filter("q", e.target.value)}
        />
        <select
          aria-label={t.admin.filterByProvider}
          className={selectClass}
          value={filters.provider}
          onChange={(e) => filter("provider", e.target.value)}
        >
          <option value="">{t.admin.filterByProvider}</option>
          <option value="CLICKUP">{t.integrationsSection.providerClickUp}</option>
          <option value="CLOCKIFY">{t.integrationsSection.providerClockify}</option>
          <option value="KOLAY_IK">{t.integrationsSection.providerKolayIk}</option>
        </select>
        <select
          aria-label={t.admin.filterByStatus}
          className={selectClass}
          value={filters.status}
          onChange={(e) => filter("status", e.target.value)}
        >
          <option value="">{t.admin.filterByStatus}</option>
          <option value="CONFIGURED">CONFIGURED</option>
          <option value="CONNECTED">CONNECTED</option>
          <option value="ERROR">ERROR</option>
          <option value="NOT_CONFIGURED">NOT_CONFIGURED</option>
        </select>
        {filters.companyId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => filter("companyId", "")}
          >
            {t.admin.allCompanies} &times;
          </Button>
        )}
      </FilterBar>

      {state.error ? (
        <DataError message={errorText(state.error, t)} onRetry={state.reload} />
      ) : !state.data ? (
        <PageSkeleton />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={state.data.items}
            emptyTitle={t.admin.noIntegrationsConfigured}
            emptyDescription={t.admin.noIntegrationsMatch}
          />
          <TablePagination
            {...state.data}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t.admin.configureIntegration}</DialogTitle>
          <DialogDescription>{t.integrationsSection.subtitle}</DialogDescription>

          <form onSubmit={handleSaveConfigure} className="space-y-4 mt-3">
            {modalError && <FormAlert message={modalError} />}

            {!modalCompanyName ? (
              <CompanyPicker
                value={modalCompanyId}
                onChange={(id, name) => {
                  setModalCompanyId(id);
                  setModalCompanyName(name);
                }}
              />
            ) : (
              <div className="rounded-lg border p-3 bg-slate-50 flex items-center justify-between text-sm">
                <div>
                  <span className="font-semibold">{t.admin.company}:</span> {modalCompanyName}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setModalCompanyId("");
                    setModalCompanyName("");
                  }}
                >
                  {t.common.edit}
                </Button>
              </div>
            )}

            <Field label={t.admin.integrations}>
              <select
                className={selectClass}
                value={modalProvider}
                onChange={(e) => setModalProvider(e.target.value as any)}
              >
                <option value="CLICKUP">{t.integrationsSection.providerClickUp}</option>
                <option value="CLOCKIFY">{t.integrationsSection.providerClockify}</option>
                <option value="KOLAY_IK">{t.integrationsSection.providerKolayIk}</option>
              </select>
            </Field>

            {modalProvider === "CLICKUP" && (
              <>
                <Field label={t.integrationsSection.apiTokenLabel}>
                  <Input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    required
                    placeholder="pk_..."
                  />
                </Field>
                <Field label={t.integrationsSection.listIdLabel}>
                  <Input
                    type="text"
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    placeholder="12345678"
                  />
                </Field>
              </>
            )}

            {modalProvider === "CLOCKIFY" && (
              <>
                <Field label={t.integrationsSection.apiKeyLabel}>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                    placeholder="API key"
                  />
                </Field>
                <Field label={t.integrationsSection.workspaceLabel}>
                  <Input
                    type="text"
                    value={workspaceId}
                    onChange={(e) => setWorkspaceId(e.target.value)}
                    placeholder="Workspace ID"
                  />
                </Field>
              </>
            )}

            {modalProvider === "KOLAY_IK" && (
              <>
                <Field label={t.integrationsSection.apiTokenLabel}>
                  <Input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    required
                    placeholder="Bearer token"
                  />
                </Field>
                <Field label="API Base URL">
                  <Input
                    type="text"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="https://api.kolayik.com"
                  />
                </Field>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t.common.loading : t.common.save}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Frame>
  );
}
