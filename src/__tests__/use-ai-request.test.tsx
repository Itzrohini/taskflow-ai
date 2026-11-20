import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiRequest } from "@/hooks/use-ai-request";

afterEach(cleanup);

describe("useAiRequest", () => {
  it("ignores another run while a request is loading", async () => {
    let resolveRequest: (value: string) => void = () => undefined;
    const request = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { result } = renderHook(() => useAiRequest(request));
    let firstRequest: Promise<string | undefined> | undefined;

    await act(async () => {
      firstRequest = result.current.run("first");
      await result.current.run("second");
    });
    expect(request).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRequest("suggestion");
      await firstRequest;
    });
    expect(result.current.data).toBe("suggestion");
    expect(result.current.loading).toBe(false);
  });

  it("cancels the request and ignores a late result", async () => {
    let resolveRequest: (value: string) => void = () => undefined;
    let signal: AbortSignal | undefined;
    const request = vi.fn(
      (_input: string, requestSignal: AbortSignal) => {
        signal = requestSignal;
        return new Promise<string>((resolve) => {
          resolveRequest = resolve;
        });
      },
    );
    const { result } = renderHook(() => useAiRequest(request));
    let pending: Promise<string | undefined> | undefined;

    await act(async () => {
      pending = result.current.run("stale");
    });
    act(() => result.current.cancel());
    expect(signal?.aborted).toBe(true);

    await act(async () => {
      resolveRequest("late suggestion");
      await pending;
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
