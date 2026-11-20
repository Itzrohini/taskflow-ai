"use client";

import { CheckCircle2, Clock3, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiPlanResponse, Task } from "@/lib/types";

interface PlanCardProps {
  plan: AiPlanResponse;
  tasksById: Record<string, Task>;
  onDismiss: () => void;
}

export function PlanCard({ plan, tasksById, onDismiss }: PlanCardProps) {
  return (
    <Card className="rounded-2xl border-indigo-100 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base text-indigo-950">
            Today&apos;s plan
          </CardTitle>
          <p className="mt-1 text-sm text-slate-600">{plan.summary}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss today's plan"
          onClick={onDismiss}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {plan.plan.length > 0 ? (
          <ol className="space-y-2">
            {plan.plan.map((item, index) => {
              const isCompleted = tasksById[item.task_id]?.completed ?? false;
              return (
                <li
                  key={item.task_id}
                  className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-indigo-700 ring-1 ring-slate-200">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`break-words text-sm font-medium ${
                        isCompleted ? "text-slate-400 line-through" : "text-slate-900"
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="secondary" className="gap-1">
                      <Clock3 aria-hidden="true" className="size-3" />
                      {item.minutes} min
                    </Badge>
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 aria-hidden="true" className="size-3.5" />
                        Completed
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-slate-600">No tasks in this plan.</p>
        )}
        <p className="text-xs text-slate-500">Plan is for this session only.</p>
      </CardContent>
    </Card>
  );
}
