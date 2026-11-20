"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AiRequest<Input, Output> = (
  input: Input,
  signal: AbortSignal,
) => Promise<Output>;

export function useAiRequest<Input, Output>(
  request: AiRequest<Input, Output>,
) {
  const [data, setData] = useState<Output | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestId.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const cancel = useCallback(() => {
    requestId.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    loadingRef.current = false;
    setLoading(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setData(null);
    setError(null);
  }, [cancel]);

  const run = useCallback(
    async (input: Input): Promise<Output | undefined> => {
      if (loadingRef.current) return undefined;

      const currentRequestId = ++requestId.current;
      const controller = new AbortController();
      controllerRef.current = controller;
      loadingRef.current = true;
      setLoading(true);
      setData(null);
      setError(null);

      try {
        const result = await request(input, controller.signal);
        if (
          mountedRef.current &&
          currentRequestId === requestId.current &&
          !controller.signal.aborted
        ) {
          setData(result);
          return result;
        }
      } catch (requestError) {
        if (
          mountedRef.current &&
          currentRequestId === requestId.current &&
          !controller.signal.aborted
        ) {
          setError(requestError);
        }
      } finally {
        if (currentRequestId === requestId.current) {
          controllerRef.current = null;
          loadingRef.current = false;
          if (mountedRef.current) setLoading(false);
        }
      }

      return undefined;
    },
    [request],
  );

  return { run, data, loading, error, reset, cancel };
}
