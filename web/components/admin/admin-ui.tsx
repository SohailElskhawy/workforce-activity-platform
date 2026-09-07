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
        <details className="w-full sm:w-96">
          <summary className="cursor-pointer text-sm">
            {t.admin.filterCompany}
            {filters.companyId ? ` · ${filters.companyId.slice(0, 8)}` : ""}
          </summary>
          <CompanyPicker
            optional
            value={filters.companyId}
            onChange={(id) => filter("companyId", id)}
          />
        </details>
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
        <details className="w-full sm:w-96">
          <summary className="cursor-pointer text-sm">
            {t.admin.filterCompany}
            {filters.companyId ? ` · ${filters.companyId.slice(0, 8)}` : ""}
          </summary>
          <CompanyPicker
            optional
            value={filters.companyId}
            onChange={(id) => filter("companyId", id)}
          />
        </details>
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
            <h2 className="font-semibold">{t.admin.integrations}</h2>
            <p className="text-sm text-muted-foreground">
              {t.admin.noIntegrations}
            </p>
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
