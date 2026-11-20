"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPriority } from "@/lib/api";
import type { TaskFilters } from "@/hooks/use-tasks";
import type { DueFilter, TaskSort } from "@/lib/types";

interface FiltersBarProps {
  filters: TaskFilters;
  active: boolean;
  onChange: (patch: Partial<TaskFilters>) => void;
  onClear: () => void;
}

function isDueFilter(value: string): value is DueFilter | "any" {
  return value === "any" || value === "today" || value === "overdue" || value === "upcoming";
}

function isTaskSort(value: string): value is TaskSort {
  return value === "created_desc" || value === "due_asc";
}

export function FiltersBar({ filters, active, onChange, onClear }: FiltersBarProps) {
  return (
    <section aria-label="Task filters" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "completed"] as const).map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={filters.status === status ? "default" : "outline"}
            aria-pressed={filters.status === status}
            onClick={() => onChange({ status })}
            className={filters.status === status ? "bg-indigo-600 hover:bg-indigo-700" : ""}
          >
            {status === "all" ? "All tasks" : status === "pending" ? "Pending" : "Completed"}
          </Button>
        ))}
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="ml-auto gap-1 text-slate-500"
          >
            <X aria-hidden="true" className="size-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(180px,1fr)_repeat(3,minmax(130px,0.65fr))]">
        <label className="relative col-span-2 sm:col-span-1">
          <span className="sr-only">Search tasks</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            type="search"
            value={filters.query}
            maxLength={100}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Search tasks…"
            className="h-10 pl-9"
          />
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-500">
          <span>Priority</span>
          <Select
            value={filters.priority}
            onValueChange={(value) => {
              if (value === "all" || isPriority(value)) onChange({ priority: value });
            }}
          >
            <SelectTrigger className="h-10 w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-500">
          <span>Due date</span>
          <Select
            value={filters.due}
            onValueChange={(value) => {
              if (value && isDueFilter(value)) onChange({ due: value });
            }}
          >
            <SelectTrigger className="h-10 w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any due date</SelectItem>
              <SelectItem value="today">Due today</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-500">
          <span>Sort by</span>
          <Select
            value={filters.sort}
            onValueChange={(value) => {
              if (value && isTaskSort(value)) onChange({ sort: value });
            }}
          >
            <SelectTrigger className="h-10 w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">Newest first</SelectItem>
              <SelectItem value="due_asc">Due date</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
    </section>
  );
}
