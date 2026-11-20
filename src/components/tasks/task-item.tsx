"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { BreakdownDialog } from "@/components/ai/breakdown-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog";
import { dueStatus, formatDueDate, localToday } from "@/lib/dates";
import type {
  SubtaskInput,
  SubtaskUpdateInput,
  Task,
  TaskUpdateInput,
} from "@/lib/types";

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string, completed: boolean) => Promise<boolean>;
  onSave: (taskId: string, input: TaskUpdateInput) => Promise<boolean>;
  onDelete: (taskId: string) => Promise<boolean>;
  onAddSubtasks: (taskId: string, subtasks: SubtaskInput[]) => Promise<boolean>;
  onSaveSubtask: (
    taskId: string,
    subtaskId: string,
    input: SubtaskUpdateInput,
  ) => Promise<boolean>;
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<boolean>;
}

const priorityClasses = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-indigo-50 text-indigo-700",
  high: "bg-rose-50 text-rose-700",
};

export function TaskItem({
  task,
  onToggle,
  onSave,
  onDelete,
  onAddSubtasks,
  onSaveSubtask,
  onDeleteSubtask,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const due = dueStatus(task.due_date, localToday(), task.completed);
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;

  return (
    <Card className="rounded-xl border-0 shadow-sm ring-1 ring-slate-200/70 transition-shadow hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.completed}
            onCheckedChange={(checked) => void onToggle(task.id, checked === true)}
            aria-label={`Mark ${task.title} ${task.completed ? "pending" : "completed"}`}
            className="mt-1"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className={`break-words text-sm font-semibold sm:text-base ${
                  task.completed ? "text-slate-400 line-through" : "text-slate-900"
                }`}
              >
                {task.title}
              </h2>
              <Badge className={`border-0 capitalize ${priorityClasses[task.priority]}`}>
                {task.priority}
              </Badge>
              {task.due_date && due !== "none" && (
                <Badge
                  className={
                    due === "overdue"
                      ? "border-0 bg-rose-50 text-rose-700"
                      : due === "today"
                        ? "border-0 bg-amber-50 text-amber-700"
                        : "border-0 bg-slate-100 text-slate-600"
                  }
                >
                  {due === "overdue"
                    ? "Overdue"
                    : due === "today"
                      ? "Due today"
                      : `Due ${formatDueDate(task.due_date)}`}
                </Badge>
              )}
            </div>

            {task.description && (
              <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-500">
                {task.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {task.due_date && due === "none" && (
                <span>Due {formatDueDate(task.due_date)}</span>
              )}
              {task.estimated_duration && <span>{task.estimated_duration} min</span>}
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`subtasks-${task.id}`}
                onClick={() => setExpanded((current) => !current)}
                className="inline-flex items-center gap-1 rounded-sm font-medium text-indigo-700 outline-none hover:text-indigo-900 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {task.subtasks.length > 0
                  ? `${completedSubtasks}/${task.subtasks.length} subtasks`
                  : "Add subtasks"}
                {expanded ? (
                  <ChevronUp aria-hidden="true" className="size-3.5" />
                ) : (
                  <ChevronDown aria-hidden="true" className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          <div
            role="group"
            aria-label="Task actions"
            className="flex shrink-0 items-center gap-0.5 border-l border-slate-100 pl-2"
          >
            {!task.completed && (
              <BreakdownDialog task={task} onAdd={onAddSubtasks} />
            )}
            <TaskEditDialog task={task} onSave={onSave} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${task.title}`}
                  className="text-slate-500 hover:text-rose-600"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{task.title}” and its subtasks will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => void onDelete(task.id)}
                  >
                    Delete task
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div id={`subtasks-${task.id}`} className="ml-7" hidden={!expanded}>
          <SubtaskList
            taskId={task.id}
            subtasks={task.subtasks}
            onAdd={onAddSubtasks}
            onToggle={(id, subtaskId, completed) =>
              onSaveSubtask(id, subtaskId, { completed })
            }
            onDelete={onDeleteSubtask}
          />
        </div>
      </CardContent>
    </Card>
  );
}
