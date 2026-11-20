import type {
  Priority,
  Stats,
  SubtaskInput,
  SubtaskUpdateInput,
  Task,
  TaskCreateInput,
  TaskListParams,
  TaskListResponse,
  TaskUpdateInput,
} from "@/lib/types";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isDetailResponse(value: unknown): value is { detail: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "detail" in value &&
    typeof value.detail === "string"
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError("The request timed out. Please try again.", 0);
    }
    throw new ApiError(
      "The backend could not be reached. Check that it is running and try again.",
      0,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const message = isDetailResponse(data)
      ? data.detail
      : `The request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  if (data === undefined) {
    throw new ApiError("The server returned an invalid response.", response.status);
  }

  return data as T;
}

export async function listTasks(
  params: TaskListParams = {},
): Promise<TaskListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const search = query.toString();
  return request<TaskListResponse>(
    `/api/v1/tasks/${search ? `?${search}` : ""}`,
  );
}

export function getStats(today: string): Promise<Stats> {
  const query = new URLSearchParams({ today });
  return request<Stats>(`/api/v1/tasks/stats?${query.toString()}`);
}

export function getTask(taskId: string): Promise<Task> {
  return request<Task>(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
}

export function createTask(input: TaskCreateInput): Promise<Task> {
  return request<Task>("/api/v1/tasks/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTask(
  taskId: string,
  input: TaskUpdateInput,
): Promise<Task> {
  return request<Task>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTask(taskId: string): Promise<void> {
  return request<void>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
}

export function addSubtasks(
  taskId: string,
  subtasks: SubtaskInput[],
): Promise<Task> {
  return request<Task>(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/subtasks`,
    {
      method: "POST",
      body: JSON.stringify({ subtasks }),
    },
  );
}

export function updateSubtask(
  taskId: string,
  subtaskId: string,
  input: SubtaskUpdateInput,
): Promise<Task> {
  return request<Task>(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteSubtask(
  taskId: string,
  subtaskId: string,
): Promise<Task> {
  return request<Task>(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`,
    { method: "DELETE" },
  );
}

export function isPriority(value: string): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}
