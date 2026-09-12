"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CompanyFilterProps {
  value: string;
  initialName?: string;
  onChange: (companyId: string, companyName: string) => void;
  className?: string;
  disabled?: boolean;
}

interface CompanyItem {
  id: string;
  name: string;
}

export function CompanyFilter({
  value,
  initialName = "",
  onChange,
  className = "",
  disabled = false,
}: CompanyFilterProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local cache for company id -> name resolution
  const [companyNames, setCompanyNames] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (value && initialName) {
      initial[value] = initialName;
    }
    return initial;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [open]);

  // Fetch companies on mount, open, or search
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          page: "1",
          pageSize: query.trim() ? "50" : "100",
        });
        if (query.trim()) {
          params.set("q", query.trim());
        }

        fetch(`/api/admin/companies?${params.toString()}`)
          .then((res) => {
            if (!res.ok) throw new Error("Failed to load companies");
            return res.json();
          })
          .then((data: { items: CompanyItem[] }) => {
            if (!active) return;
            setCompanies(data.items ?? []);
            setCompanyNames((prev) => {
              const next = { ...prev };
              for (const c of data.items ?? []) {
                next[c.id] = c.name;
              }
              return next;
            });
            setLoading(false);
          })
          .catch((err) => {
            if (!active) return;
            setError(err.message || "Failed to load");
            setLoading(false);
          });
      },
      query.trim() ? 200 : 0,
    );

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const selectedName =
    value && companyNames[value]
      ? companyNames[value]
      : value
        ? `${value.slice(0, 8)}...`
        : "";

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger Button */}
      <div className="flex items-center">
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={t.admin.filterCompany}
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "flex h-9 min-w-[190px] max-w-[260px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors",
            "hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring outline-none",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? selectedName : t.admin.allCompanies}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {value ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear company filter"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("", "");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onChange("", "");
                  }
                }}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
              >
                <X className="size-3.5" />
              </span>
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </div>

      {/* Floating Popover */}
      {open && (
        <div
          role="listbox"
          aria-label={t.admin.filterCompany}
          className="absolute left-0 top-full z-50 mt-1.5 w-[280px] sm:w-[320px] rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {/* Search Header */}
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.common.search}
              className="h-8 pl-8 pr-7 text-xs"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* List Area */}
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {/* "All Companies" Option */}
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange("", "");
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                !value
                  ? "bg-accent font-medium text-accent-foreground"
                  : "hover:bg-accent/50 text-foreground",
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{t.admin.allCompanies}</span>
              </div>
              {!value && <Check className="size-3.5 text-primary shrink-0" />}
            </button>

            {/* Separator */}
            <div className="my-1 border-t border-border/50" />

            {/* Loading State */}
            {loading && companies.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                <span>{t.common.loading}</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-2 text-center text-xs text-destructive space-y-1">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setQuery((q) => q + " ")}
                  className="underline hover:text-destructive/80 font-medium"
                >
                  {t.common.retry}
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && companies.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {t.common.noResults}
              </div>
            )}

            {/* Company Items */}
            {companies.map((c) => {
              const isSelected = value === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setCompanyNames((prev) => ({ ...prev, [c.id]: c.name }));
                    onChange(c.id, c.name);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    isSelected
                      ? "bg-accent font-medium text-accent-foreground"
                      : "hover:bg-accent/50 text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{c.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      · {c.id.slice(0, 8)}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="size-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
