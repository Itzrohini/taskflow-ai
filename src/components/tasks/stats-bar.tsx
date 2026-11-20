import { CheckCheck, CircleDashed, Clock3, ListTodo, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Stats } from "@/lib/types";

interface StatsBarProps {
  stats: Stats | null;
  loading: boolean;
}

const statCards = [
  { key: "total", label: "Total tasks", icon: ListTodo, color: "text-indigo-600" },
  { key: "pending", label: "Pending", icon: CircleDashed, color: "text-slate-500" },
  { key: "completed", label: "Completed", icon: CheckCheck, color: "text-emerald-600" },
  { key: "overdue", label: "Overdue", icon: Clock3, color: "text-rose-600" },
  { key: "due_today", label: "Due today", icon: Target, color: "text-amber-600" },
] as const;

export function StatsBar({ stats, loading }: StatsBarProps) {
  return (
    <section aria-label="Task statistics" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <Card key={key} className="rounded-xl border-0 shadow-sm ring-1 ring-slate-200/70">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg bg-slate-50 ${color}`}>
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                {loading || !stats ? (
                  <Skeleton className="mt-1 h-6 w-10" />
                ) : (
                  <p className="text-xl font-semibold tracking-tight text-slate-900">
                    {stats[key]}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-slate-700">Completion rate</span>
          {loading || !stats ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            <span className="font-semibold text-indigo-700">
              {stats.completion_rate.toFixed(1)}%
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="Completion rate"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stats?.completion_rate ?? 0}
          className="h-2 overflow-hidden rounded-full bg-indigo-50"
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-500"
            style={{ width: `${loading ? 0 : stats?.completion_rate ?? 0}%` }}
          />
        </div>
      </div>
    </section>
  );
}
