import { afterEach, describe, expect, it, vi } from "vitest";
import { aiBreakdown, aiImprove, aiPlan } from "@/lib/api";

function jsonResponse(status: number, body: unknown): Response {
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

describe("AI API client", () => {
  it("posts the correct endpoint bodies, including today's date", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(200, {}),
    );
    vi.stubGlobal("fetch", fetchMock);

    await aiBreakdown({ title: "Plan the release", description: "Ship safely." });
    await aiImprove({
      title: "Write notes",
      description: "For customers",
      today: "2026-11-20",
    });
    await aiPlan({ available_minutes: 240, today: "2026-11-20" });

    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      "/api/v1/ai/breakdown",
      "/api/v1/ai/improve",
      "/api/v1/ai/plan",
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { title: "Plan the release", description: "Ship safely." },
      { title: "Write notes", description: "For customers", today: "2026-11-20" },
      { available_minutes: 240, today: "2026-11-20" },
    ]);
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === "POST")).toBe(
      true,
    );
  });

  it("exposes the backend AI error code on ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(503, {
          detail: "AI unavailable",
          code: "ai_not_configured",
        }),
      ),
    );

    await expect(aiImprove({ title: "Write notes" })).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      code: "ai_not_configured",
    });
  });

  it("passes through caller abort signals and uses the 30-second AI timeout", async () => {
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
    const timeoutRequest = aiPlan({ available_minutes: 240 });
    const timeoutExpectation = expect(timeoutRequest).rejects.toMatchObject({
      name: "ApiError",
      message: "The request timed out. Please try again.",
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(15_000);
    await timeoutExpectation;

    vi.useRealTimers();
    const caller = new AbortController();
    const abortRequest = aiBreakdown({ title: "Plan" }, caller.signal);
    caller.abort();
    await expect(abortRequest).rejects.toMatchObject({
      name: "ApiError",
      message: "The request was cancelled.",
    });
    expect(fetchMock.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
  });
});
