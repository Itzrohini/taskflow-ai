import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  deleteTask,
  getStats,
  listTasks,
} from "@/lib/api";

function response(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("API client", () => {
  it("builds task list query parameters with URL encoding", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      response(200, { items: [], total: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listTasks({
      status: "pending",
      priority: "high",
      q: "a & b",
      due: "none",
      sort: "due_asc",
      limit: 25,
      skip: 5,
      today: "2026-11-20",
    });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("http://127.0.0.1:8000");
    expect(url.pathname).toBe("/api/v1/tasks/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "pending",
      priority: "high",
      q: "a & b",
      due: "none",
      sort: "due_asc",
      limit: "25",
      skip: "5",
      today: "2026-11-20",
    });
  });

  it("uses the backend detail message and status for HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        response(422, { detail: "Title is required." }),
      ),
    );

    await expect(getStats("2026-11-20")).rejects.toMatchObject({
      name: "ApiError",
      message: "Title is required.",
      status: 422,
    });
  });

  it("handles 204 responses without parsing a body", async () => {
    const noContent = response(204);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(noContent),
    );

    await expect(deleteTask("task-1")).resolves.toBeUndefined();
    expect(noContent.json).not.toHaveBeenCalled();
  });

  it("turns network failures into a friendly ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed")),
    );

    await expect(getStats("2026-11-20")).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      message: expect.stringContaining("backend could not be reached"),
    });
  });

  it("turns aborted requests into a timeout ApiError", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = expect(getStats("2026-11-20")).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      message: "The request timed out. Please try again.",
    });
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
  });

  it("exposes ApiError as a typed Error", () => {
    const error = new ApiError("bad request", 400);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
  });
});
