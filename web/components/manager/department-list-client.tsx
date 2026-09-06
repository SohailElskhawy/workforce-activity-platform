"use client";

import { Building2, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableCard } from "@/components/ui/data-table";
import { FilterBar, FilterReset, FilterSearch } from "@/components/ui/filter-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";

import { DeleteDepartmentButton } from "./delete-department-dialog";
import { EditDepartmentDialog } from "./edit-department-dialog";
import type { ManagerOption } from "./create-department-dialog";

export type DepartmentListItem = {
  id: string;
  name: string;
  managerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    position: string | null;
  } | null;
  _count: {
    employees: number;
  };
};

export function DepartmentListClient({
  departments,
  managers,
}: {
  departments: DepartmentListItem[];
  managers: ManagerOption[];
}) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return departments;
    const q = query.toLowerCase().trim();
    return departments.filter((d) => {
      const nameMatch = d.name.toLowerCase().includes(q);
      const managerName = d.manager
        ? `${d.manager.firstName} ${d.manager.lastName}`.toLowerCase()
        : "";
      const managerEmail = d.manager?.email.toLowerCase() ?? "";
      return nameMatch || managerName.includes(q) || managerEmail.includes(q);
    });
  }, [departments, query]);

  if (departments.length === 0) {
    return (
      <EmptyState
        description={t.departments.emptyDesc}
        title={t.departments.emptyTitle}
      />
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterSearch
          onChange={setQuery}
          placeholder={`${t.common.search}...`}
          value={query}
        />
        {query ? <FilterReset onReset={() => setQuery("")} /> : null}
      </FilterBar>

      <DataTableCard>
        {filtered.length === 0 ? (
          <EmptyState
            description={t.departments.emptyDesc}
            title={t.departments.emptyTitle}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.departments.name}</TableHead>
                <TableHead>{t.departments.manager}</TableHead>
                <TableHead className="text-center">
                  {t.departments.membersCount}
                </TableHead>
                <TableHead>{t.common.created}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">{t.common.actions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell>
                    <Link
                      className="group flex items-center gap-2.5 font-medium hover:text-primary transition-colors"
                      href={`/departments/${dept.id}`}
                    >
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                        <Building2 className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground group-hover:underline">
                          {dept.name}
                        </div>
                      </div>
                    </Link>
                  </TableCell>

                  <TableCell>
                    {dept.manager ? (
                      <div>
                        <div className="font-medium text-foreground">
                          {dept.manager.firstName} {dept.manager.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {dept.manager.email}
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {t.departments.noManager}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1 px-2.5">
                      <Users className="size-3 text-muted-foreground" />
                      <span>{dept._count.employees}</span>
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(dept.createdAt, locale)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <EditDepartmentDialog
                        department={{
                          id: dept.id,
                          name: dept.name,
                          managerId: dept.managerId,
                        }}
                        managers={managers}
                      />
                      <DeleteDepartmentButton
                        departmentId={dept.id}
                        departmentName={dept.name}
                      />
                      <Link
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        href={`/departments/${dept.id}`}
                        aria-label={t.common.view}
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableCard>
    </div>
  );
}
