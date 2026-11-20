"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dueStatus, formatDueDate, localToday } from "@/lib/dates";
import type { AiPlannedTask } from "@/lib/types";

interface PlanTaskRowProps {
  task: AiPlannedTask;
  index: number;
  onMinutesChange: (taskId: string, minutes: number) => void;
  onRemove: (taskId: string) => void;
}

const priorityClasses = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-indigo-50 text-indigo-700",
  high: "bg-rose-50 text-rose-700",
};

export function PlanTaskRow({
  task,
  index,
  onMinutesChange,
  onRemove,
}: PlanTaskRowProps) {
  const due = dueStatus(task.due_date, localToday());
  const dueLabel =
    due === "overdue"
      ? "Overdue"
      : due === "today"
        ? "Due today"
        : task.due_date
          ? `Due ${formatDueDate(task.due_date)}`
          : null;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <span
          aria-label={`Position ${index + 1}`}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-slate-900">
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge className={`border-0 capitalize ${priorityClasses[task.priority]}`}>
              {task.priority}
            </Badge>
            {dueLabel && (
              <span
                className={`text-xs ${
                  due === "overdue"
                    ? "font-medium text-rose-700"
                    : due === "today"
                      ? "font-medium text-amber-700"
                      : "text-slate-500"
                }`}
              >
                {dueLabel}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600">{task.reason}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${task.title} from plan`}
          onClick={() => onRemove(task.task_id)}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div className="ml-10 mt-3 flex items-center gap-2">
        <label
          htmlFor={`plan-minutes-${task.task_id}`}
          className="text-xs font-medium text-slate-600"
        >
          Minutes
        </label>
        <Input
          id={`plan-minutes-${task.task_id}`}
          type="number"
          min={1}
          max={960}
          step={1}
          value={task.minutes}
          onChange={(event) =>
            onMinutesChange(task.task_id, Number(event.target.value))
          }
          className="h-8 w-24"
        />
      </div>
    </li>
  );
}
