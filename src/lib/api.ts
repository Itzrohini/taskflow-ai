import type {
  Priority,
  AiBreakdownRequest,
  AiBreakdownResponse,
  AiImproveRequest,
  AiImproveResponse,
  AiPlanRequest,
  AiPlanResponse,
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
const AI_REQUEST_TIMEOUT_MS = 30_000;

interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiErrorResponse(
  value: unknown,
): value is { detail: string; code?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "detail" in value &&
    typeof value.detail === "string" &&
    (!("code" in value) || typeof value.code === "string")
  );
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const callerSignal = options.signal ?? init.signal ?? undefined;
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  let data: unknown;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (response.status !== 204) {
      try {
        data = await response.json();
      } catch {
        data = undefined;
      }
    }
  } catch {
    if (callerSignal?.aborted) {
      throw new ApiError("The request was cancelled.", 0);
    }
    if (timedOut) {
      throw new ApiError("The request timed out. Please try again.", 0);
    }
    throw new ApiError(
      "The backend could not be reached. Check that it is running and try again.",
      0,
    );
  } finally {
    window.clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const body = isApiErrorResponse(data) ? data : undefined;
    throw new ApiError(
      body?.detail ?? `The request failed (${response.status}).`,
      response.status,
      body?.code,
    );
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

export function aiBreakdown(
  input: AiBreakdownRequest,
  signal?: AbortSignal,
): Promise<AiBreakdownResponse> {
  return request<AiBreakdownResponse>(
    "/api/v1/ai/breakdown",
    { method: "POST", body: JSON.stringify(input) },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS, signal },
  );
}

export function aiImprove(
  input: AiImproveRequest,
  signal?: AbortSignal,
): Promise<AiImproveResponse> {
  return request<AiImproveResponse>(
    "/api/v1/ai/improve",
    { method: "POST", body: JSON.stringify(input) },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS, signal },
  );
}

export function aiPlan(
  input: AiPlanRequest,
  signal?: AbortSignal,
): Promise<AiPlanResponse> {
  return request<AiPlanResponse>(
    "/api/v1/ai/plan",
    { method: "POST", body: JSON.stringify(input) },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS, signal },
  );
}

export function isPriority(value: string): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}
