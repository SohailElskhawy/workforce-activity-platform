"use client";

import { AlertTriangle, Bell, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { formatPlural, formatTemplate } from "@/lib/i18n/format";
import type { TaskNotification } from "@/lib/services/notifications";

export function NotificationBell({ isEmployee = false }: { isEmployee?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: { notifications?: TaskNotification[] } };
      if (json.data?.notifications) {
        setNotifications(json.data.notifications);
      }
    } catch {
      // Gracefully ignore fetch failures in background
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void fetchNotifications();
    }, 180_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const count = notifications.length;
  const overdueCount = notifications.filter((n) => n.type === "TASK_OVERDUE").length;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t.common.notifications}
        className="relative inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) void fetchNotifications();
        }}
        type="button"
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span
            className={`absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${
              overdueCount > 0 ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5"
          role="dialog"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">
                {t.notifications.title}
              </h3>
              {count > 0 ? (
                <Badge
                  className="px-1.5 py-0.5 text-[11px]"
                  variant={overdueCount > 0 ? "destructive" : "secondary"}
                >
                  {count}
                </Badge>
              ) : null}
            </div>
            {count > 0 ? (
              <span className="text-xs text-slate-500">
                {formatPlural(t.notifications.unreadCount, count)}
              </span>
            ) : null}
          </div>

          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2">
                  <CheckCircle2 className="size-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {t.notifications.noNotifications}
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const isOverdue = notification.type === "TASK_OVERDUE";
                const taskHref = isEmployee ? "/my-tasks" : "/tasks";

                return (
                  <Link
                    className="block rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-100/80 hover:border-slate-200"
                    href={taskHref}
                    key={notification.id}
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5">
                        {isOverdue ? (
                          <AlertTriangle className="size-3.5 text-red-500" />
                        ) : (
                          <Clock className="size-3.5 text-amber-500" />
                        )}
                        <span
                          className={`text-xs font-semibold ${
                            isOverdue ? "text-red-600" : "text-amber-600"
                          }`}
                        >
                          {isOverdue
                            ? formatTemplate(t.notifications.overdueBy, {
                                hours: notification.hoursDifference,
                              })
                            : formatTemplate(t.notifications.dueIn, {
                                hours: notification.hoursDifference,
                              })}
                        </span>
                      </span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                        {notification.projectCode}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-sm text-slate-900 line-clamp-1">
                      {notification.taskTitle}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate">{notification.projectName}</span>
                      {notification.assignees && notification.assignees.length > 0 ? (
                        <span className="truncate text-slate-400">
                          {notification.assignees.map((a) => a.name).join(", ")}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
