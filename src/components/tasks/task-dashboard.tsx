"use client";

import { Sparkles } from "lucide-react";
import { ErrorState } from "@/components/tasks/error-state";
import { FiltersBar } from "@/components/tasks/filters-bar";
import { QuickAdd } from "@/components/tasks/quick-add";
import { StatsBar } from "@/components/tasks/stats-bar";
import { TaskList } from "@/components/tasks/task-list";
import { useTasks } from "@/hooks/use-tasks";

export function TaskDashboard() {
  const taskState = useTasks();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-indigo-700">
              TaskFlow AI
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Make room for what matters.
            </h1>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">
              A calmer place to organize your day, one task at a time.
            </p>
          </div>
        </header>

        <QuickAdd onAdd={taskState.createTask} />
        <StatsBar stats={taskState.stats} loading={taskState.isLoading} />
        <FiltersBar
          filters={taskState.filters}
          active={taskState.hasActiveFilters}
          onChange={taskState.updateFilters}
          onClear={taskState.clearFilters}
        />

        {taskState.error ? (
          <ErrorState
            message={taskState.error.message}
            unreachable={taskState.error.unreachable}
            onRetry={() => void taskState.refresh()}
          />
        ) : (
          <TaskList
            tasks={taskState.tasks}
            loading={taskState.isLoading}
            hasFilters={taskState.hasActiveFilters}
            onClearFilters={taskState.clearFilters}
            onToggleTask={taskState.toggleTask}
            onSaveTask={taskState.saveTask}
            onDeleteTask={taskState.removeTask}
            onAddSubtasks={taskState.addSubtasks}
            onSaveSubtask={taskState.saveSubtask}
            onDeleteSubtask={taskState.removeSubtask}
          />
        )}

        <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Your tasks, thoughtfully organized.
        </footer>
      </div>
    </main>
  );
}
