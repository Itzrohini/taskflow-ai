"use client";

import { AiButton } from "@/components/ai/ai-button";
import { AiError } from "@/components/ai/ai-error";
import { useAiRequest } from "@/hooks/use-ai-request";
import { aiImprove } from "@/lib/api";
import { localToday } from "@/lib/dates";
import type {
  AiImproveRequest,
  AiImproveResponse,
  Priority,
} from "@/lib/types";

export interface ImproveSource {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
}

interface ImproveActionProps {
  source: ImproveSource;
  onSuggestion: (
    suggestion: AiImproveResponse,
    source: ImproveSource,
  ) => void;
}

export function ImproveAction({
  source,
  onSuggestion,
}: ImproveActionProps) {
  const { run, loading, error } =
    useAiRequest<AiImproveRequest, AiImproveResponse>(aiImprove);

  async function improve(values: ImproveSource) {
    const request: AiImproveRequest = {
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      today: localToday(),
    };
    const suggestion = await run(request);
    if (suggestion) onSuggestion(suggestion, values);
  }

  function start() {
    if (!source.title.trim()) return;
    void improve({ ...source });
  }

  return (
    <div className="space-y-2">
      <AiButton
        label="Improve with AI"
        loadingLabel="Improving..."
        loading={loading}
        disabled={!source.title.trim()}
        onClick={start}
      />
      {error !== null && <AiError error={error} onRetry={start} />}
    </div>
  );
}
