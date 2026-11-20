export type Priority = "low" | "medium" | "high";
export type TaskStatus = "all" | "pending" | "completed";
export type DueFilter = "today" | "overdue" | "upcoming" | "none";
export type TaskSort = "created_desc" | "due_asc";

export interface Subtask {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  completed: boolean;
  due_date: string | null;
  estimated_duration: number | null;
  subtasks: Subtask[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
}

export interface PriorityCounts {
  low: number;
  medium: number;
  high: number;
}

export interface Stats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  due_today: number;
  completion_rate: number;
  pending_by_priority: PriorityCounts;
}

export interface TaskListParams {
  status?: TaskStatus;
  priority?: Priority;
  q?: string;
  due?: DueFilter;
  sort?: TaskSort;
  limit?: number;
  skip?: number;
  today?: string;
}

export interface SubtaskInput {
  title: string;
  description?: string | null;
}

export interface TaskCreateInput {
  title: string;
  description?: string | null;
  priority?: Priority;
  due_date?: string | null;
  estimated_duration?: number | null;
  subtasks?: SubtaskInput[];
}

export interface TaskUpdateInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
  due_date?: string | null;
  estimated_duration?: number | null;
  completed?: boolean;
}

export interface SubtaskUpdateInput {
  title?: string;
  description?: string | null;
  completed?: boolean;
}
