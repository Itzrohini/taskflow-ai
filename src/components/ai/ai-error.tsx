"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiErrorMessage } from "@/lib/ai-errors";

interface AiErrorProps {
  error: unknown;
  onRetry: () => void;
}

export function AiError({ error, onRetry }: AiErrorProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>{aiErrorMessage(error)}</p>
        <Button
          type="button"
          variant="link"
          className="mt-1 h-auto p-0 text-rose-800"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    </div>
  );
}
