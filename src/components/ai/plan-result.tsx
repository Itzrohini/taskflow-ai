"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanTaskRow } from "@/components/ai/plan-task-row";
import type { AiPlanResponse } from "@/lib/types";

interface PlanResultProps {
  result: AiPlanResponse;
  availableMinutes: number;
  onMinutesChange: (taskId: string, minutes: number) => void;
  onRemove: (taskId: string) => void;
  onAccept: (result: AiPlanResponse) => void;
  onCancel: () => void;
}

export function PlanResult({
  result,
  availableMinutes,
  onMinutesChange,
  onRemove,
  onAccept,
  onCancel,
}: PlanResultProps) {
  const total = result.plan.reduce((sum, task) => sum + task.minutes, 0);
  const overBudget = total > availableMinutes;

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
        {result.summary}
      </p>
      {result.warnings.length > 0 && (
        <div
          role="alert"
          className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden="true" className="size-4" />
            A few things to keep in mind
          </p>
          <ul className="list-inside list-disc">
            {result.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      <section aria-labelledby="plan-tasks-title" className="space-y-2">
        <h3 id="plan-tasks-title" className="text-sm font-semibold text-slate-800">
          Suggested order
        </h3>
        {result.plan.length > 0 ? (
          <ol className="space-y-2">
            {result.plan.map((task, index) => (
              <PlanTaskRow
                key={task.task_id}
                task={task}
                index={index}
                onMinutesChange={onMinutesChange}
                onRemove={onRemove}
              />
            ))}
          </ol>
        ) : (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            No tasks were included in this plan.
          </p>
        )}
      </section>
      <section aria-labelledby="postponed-title" className="space-y-2">
        <h3 id="postponed-title" className="text-sm font-semibold text-slate-800">
          Postponed
        </h3>
        {result.postponed.length > 0 ? (
          <ul className="space-y-2">
            {result.postponed.map((task) => (
              <li
                key={task.task_id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <p className="text-sm font-medium text-slate-800">{task.title}</p>
                <p className="mt-1 text-sm text-slate-600">{task.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">None for now.</p>
        )}
      </section>
      <div
        role={overBudget ? "alert" : "status"}
        className={`flex items-center justify-between gap-3 border-t pt-3 text-sm font-semibold ${
          overBudget ? "border-rose-200 text-rose-700" : "border-slate-200 text-slate-700"
        }`}
      >
        <span>Planned time</span>
        <span>
          {total} / {availableMinutes} min
          {overBudget && (
            <span className="ml-2 font-normal">
              This plan exceeds the available time.
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={result.plan.length === 0}
          onClick={() => onAccept({ ...result, total_minutes: total })}
        >
          Accept plan
        </Button>
      </div>
    </div>
  );
}
