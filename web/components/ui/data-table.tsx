"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { DataError } from "@/components/states/data-error";
import { EmptyState } from "@/components/states/empty-state";
import { TableSkeleton } from "@/components/states/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";

export type ColumnDef<T> = {
  header: ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function TablePagination({
  onPageChange,
  page,
  pageSize,
  total,
}: PaginationProps) {
  const { t } = useI18n();

  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:px-6">
      <p className="text-xs text-slate-500">
        {t.common.showing} <span className="font-medium text-slate-900">{start}</span>–
        <span className="font-medium text-slate-900">{end}</span> {t.common.of}{" "}
        <span className="font-medium text-slate-900">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          aria-label={t.common.previous}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">{t.common.previous}</span>
        </Button>
        <span className="px-2 text-xs font-medium text-slate-600">
          {page} / {totalPages}
        </span>
        <Button
          aria-label={t.common.next}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <span className="hidden sm:inline">{t.common.next}</span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  pagination?: PaginationProps;
  keyExtractor?: (item: T, index: number) => string;
  className?: string;
};

export function DataTable<T>({
  className = "",
  columns,
  data,
  emptyAction,
  emptyDescription = "No records found.",
  emptyTitle = "No data",
  error,
  isLoading = false,
  keyExtractor,
  onRetry,
  pagination,
}: DataTableProps<T>) {
  return (
    <Card className={`overflow-hidden border-slate-200 shadow-sm ${className}`}>
      <CardContent className="p-0">
        {isLoading ? (
          <TableSkeleton columns={columns.length} rows={5} />
        ) : error ? (
          <DataError message={error} onRetry={onRetry} />
        ) : data.length === 0 ? (
          <EmptyState
            action={emptyAction}
            description={emptyDescription}
            title={emptyTitle}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column, colIdx) => (
                    <TableHead
                      className={column.headerClassName}
                      key={colIdx}
                    >
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, rowIdx) => {
                  const key = keyExtractor
                    ? keyExtractor(item, rowIdx)
                    : (item as { id?: string })?.id ?? `row-${rowIdx}`;
                  return (
                    <TableRow key={key}>
                      {columns.map((column, colIdx) => {
                        let content: ReactNode = null;
                        if (column.cell) {
                          content = column.cell(item, rowIdx);
                        } else if (column.accessorKey) {
                          content = String(item[column.accessorKey] ?? "—");
                        }
                        return (
                          <TableCell
                            className={column.className}
                            key={`cell-${colIdx}`}
                          >
                            {content}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {pagination && !isLoading && !error && data.length > 0 ? (
          <TablePagination {...pagination} />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DataTableCard({
  children,
  className = "",
  pagination,
}: {
  children: ReactNode;
  className?: string;
  pagination?: PaginationProps;
}) {
  return (
    <Card className={`overflow-hidden border-slate-200 shadow-sm ${className}`}>
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
        {pagination ? <TablePagination {...pagination} /> : null}
      </CardContent>
    </Card>
  );
}
