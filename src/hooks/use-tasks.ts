"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addSubtasks as addSubtasksRequest,
  ApiError,
  createTask as createTaskRequest,
  deleteSubtask as deleteSubtaskRequest,
  deleteTask as deleteTaskRequest,
  getStats,
  listTasks,
  updateSubtask as updateSubtaskRequest,
  updateTask as updateTaskRequest,
} from "@/lib/api";
import { localToday } from "@/lib/dates";
import type {
  DueFilter,
  Priority,
  Stats,
  SubtaskInput,
  SubtaskUpdateInput,
  Task,
  TaskCreateInput,
  TaskListParams,
  TaskSort,
  TaskStatus,
  TaskUpdateInput,
} from "@/lib/types";

export interface TaskFilters {
  status: TaskStatus;
  priority: Priority | "all";
  due: DueFilter | "any";
  query: string;
  sort: TaskSort;
}

interface LoadError {
  message: string;
  unreachable: boolean;
}

const INITIAL_FILTERS: TaskFilters = {
  status: "all",
  priority: "all",
  due: "any",
  query: "",
  sort: "created_desc",
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskById, setTaskById] = useState<Record<string, Task>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFiltersState] = useState<TaskFilters>(INITIAL_FILTERS);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const requestId = useRef(0);
  const today = localToday();

  const rememberTasks = useCallback((items: Task[]) => {
    setTaskById((current) => ({
      ...current,
      ...Object.fromEntries(items.map((task) => [task.id, task])),
    }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(filters.query.trim().slice(0, 100)),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [filters.query]);

  const params = useMemo<TaskListParams>(
    () => ({
      status: filters.status,
      priority: filters.priority === "all" ? undefined : filters.priority,
      q: debouncedQuery || undefined,
      due: filters.due === "any" ? undefined : filters.due,
      sort: filters.sort,
      limit: 200,
      skip: 0,
      today,
    }),
    [debouncedQuery, filters.due, filters.priority, filters.sort, filters.status, today],
  );

  const fetchData = useCallback(
    () => Promise.all([listTasks(params), getStats(today)]),
    [params, today],
  );

  useEffect(() => {
    let active = true;
    const currentRequestId = ++requestId.current;
    fetchData()
      .then(([taskResponse, statsResponse]) => {
        if (active && currentRequestId === requestId.current) {
          setTasks(taskResponse.items);
          rememberTasks(taskResponse.items);
          setStats(statsResponse);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active && currentRequestId === requestId.current) {
          setError({
            message: errorMessage(loadError),
            unreachable: loadError instanceof ApiError && loadError.status === 0,
          });
        }
      })
      .finally(() => {
        if (active && currentRequestId === requestId.current) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
      requestId.current += 1;
    };
  }, [fetchData, rememberTasks]);

  const loadData = useCallback(
    async (showLoading = false) => {
      const currentRequestId = ++requestId.current;
      if (showLoading) setIsLoading(true);
      setError(null);

      try {
        const [taskResponse, statsResponse] = await fetchData();
        if (currentRequestId === requestId.current) {
          setTasks(taskResponse.items);
          rememberTasks(taskResponse.items);
          setStats(statsResponse);
        }
      } catch (loadError) {
        if (currentRequestId === requestId.current) {
          setError({
            message: errorMessage(loadError),
            unreachable: loadError instanceof ApiError && loadError.status === 0,
          });
        }
      } finally {
        if (currentRequestId === requestId.current) {
          setIsLoading(false);
        }
      }
    },
    [fetchData, rememberTasks],
  );

  const updateFilters = useCallback((patch: Partial<TaskFilters>) => {
    setFiltersState((current) => ({ ...current, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(INITIAL_FILTERS);
  }, []);

  const refresh = useCallback(() => loadData(true), [loadData]);

  const refreshAfterMutation = useCallback(
    async (updatedTask?: Task) => {
      if (updatedTask) {
        rememberTasks([updatedTask]);
        setTasks((current) => [
          updatedTask,
          ...current.filter((task) => task.id !== updatedTask.id),
        ]);
      }
      await loadData(false);
    },
    [loadData, rememberTasks],
  );

  const createTask = useCallback(
    async (input: TaskCreateInput): Promise<boolean> => {
      try {
        const created = await createTaskRequest(input);
        rememberTasks([created]);
        setTasks((current) => [created, ...current]);
        toast.success("Task added");
        await refreshAfterMutation();
        return true;
      } catch (mutationError) {
        toast.error(errorMessage(mutationError));
        return false;
      }
    },
    [refreshAfterMutation, rememberTasks],
  );

  const toggleTask = useCallback(
    async (taskId: string, completed: boolean): Promise<boolean> => {
      const previous = tasks.find((task) => task.id === taskId);
      if (!previous) {
        return false;
      }
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, completed } : task)),
      );
      setTaskById((current) => ({
        ...current,
        [taskId]: { ...previous, completed },
      }));
      try {
        const updated = await updateTaskRequest(taskId, { completed });
        toast.success(completed ? "Task completed" : "Task reopened");
        await refreshAfterMutation(updated);
        return true;
      } catch (mutationError) {
        setTasks((current) =>
          current.map((task) => (task.id === taskId ? previous : task)),
        );
        setTaskById((current) => ({ ...current, [taskId]: previous }));
        toast.error(errorMessage(mutationError));
        return false;
      }
    },
    [refreshAfterMutation, tasks],
  );

  const saveTask = useCallback(
    async (taskId: string, input: TaskUpdateInput): Promise<boolean> => {
      try {
        const updated = await updateTaskRequest(taskId, input);
        toast.success("Task updated");
        await refreshAfterMutation(updated);
        return true;
      } catch (mutationError) {
        toast.error(errorMessage(mutationError));
        return false;
      }
    },
    [refreshAfterMutation],
  );

  const removeTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        await deleteTaskRequest(taskId);
        setTasks((current) => current.filter((task) => task.id !== taskId));
        setTaskById((current) => {
          const next = { ...current };
          delete next[taskId];
          return next;
        });
        toast.success("Task deleted");
        await loadData(false);
        return true;
      } catch (mutationError) {
        toast.error(errorMessage(mutationError));
        return false;
      }
    },
    [loadData],
  );

  const addSubtasks = useCallback(
    async (taskId: string, subtasks: SubtaskInput[]): Promise<boolean> => {
      try {
        const updated = await addSubtasksRequest(taskId, subtasks);
        toast.success(subtasks.length === 1 ? "Subtask added" : "Subtasks added");
        await refreshAfterMutation(updated);
        return true;
      } catch (mutationError) {
        toast.error(errorMessage(mutationError));
        return false;
      }
    },
    [refreshAfterMutation],
  );

  const saveSubtask = useCallback(
    async (
      taskId: string,
      subtaskId: string,
      input: SubtaskUpdateInput,
    ): Promise<boolean> => {
      try {
        const updated = await updateSubtaskRequest(taskId, subtaskId, input);
        toast.success(
          input.completed === undefined
            ? "Subtask updated"
            : input.completed
              ? "Subtask completed"
              : "Subtask reopened",
        );
        await refreshAfterMutation(updated);
        return true;
      } catch (mutationError) {
        toast.error(errorMessage(mutationError));
        return false;
      }
    },
    [refreshAfterMutation],
  );

  const removeSubtask = useCallback(
    async (taskId: string, subtaskId: string): Promise<boolean> => {
      try {
        const updated = await deleteSubtaskRequest(taskId, subtaskId);
        toast.success("Subtask deleted");
        await refreshAfterMutation(updated);
        return true;
      } catch (mutationError) {
        toast.error(errorMessage(mutationError));
        return false;
      }
    },
    [refreshAfterMutation],
  );

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.due !== "any" ||
    filters.query.trim().length > 0 ||
    filters.sort !== "created_desc";

  return {
    tasks,
    taskById,
    stats,
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    isLoading,
    error,
    refresh,
    createTask,
    toggleTask,
    saveTask,
    removeTask,
    addSubtasks,
    saveSubtask,
    removeSubtask,
  };
}
