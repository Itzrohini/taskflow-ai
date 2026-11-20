"use client";

import { useRef, useState, type FormEvent } from "react";
import { AiButton } from "@/components/ai/ai-button";
import {
  BreakdownEditor,
  breakdownDraftValue,
  type BreakdownDraft,
} from "@/components/ai/breakdown-editor";
import { AiError } from "@/components/ai/ai-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAiRequest } from "@/hooks/use-ai-request";
import { aiBreakdown } from "@/lib/api";
import type { AiBreakdownRequest, AiBreakdownResponse, Task } from "@/lib/types";

interface BreakdownDialogProps {
  task: Task;
  onAdd: (
    taskId: string,
    subtasks: Array<{ title: string; description?: string | null }>,
  ) => Promise<boolean>;
}

export function BreakdownDialog({ task, onAdd }: BreakdownDialogProps) {
  const { run, loading, error, reset } =
    useAiRequest<AiBreakdownRequest, AiBreakdownResponse>(aiBreakdown);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BreakdownDraft[]>([]);
  const [baseline, setBaseline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nextKey = useRef(0);

  async function generate() {
    const result = await run({
      title: task.title,
      description: task.description ?? undefined,
    });
    if (!result) return;
    const drafts = result.subtasks.map((subtask) => ({
      key: nextKey.current++,
      selected: true,
      title: subtask.title,
      description: subtask.description ?? "",
    }));
    setRows(drafts);
    setBaseline(breakdownDraftValue(drafts));
  }

  function start() {
    setRows([]);
    setBaseline("");
    setOpen(true);
    void generate();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
      setRows([]);
      setBaseline("");
    }
    setOpen(nextOpen);
  }

  function updateRow(key: number, patch: Partial<BreakdownDraft>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = rows.filter((row) => row.selected);
    if (
      selected.length === 0 ||
      selected.some((row) => !row.title.trim()) ||
      selected.length > 30
    ) {
      return;
    }

    setSubmitting(true);
    const saved = await onAdd(
      task.id,
      selected.map((row) => ({
        title: row.title.trim(),
        description: row.description.trim() || undefined,
      })),
    );
    setSubmitting(false);
    if (saved) handleOpenChange(false);
  }

  const selectedCount = rows.filter((row) => row.selected).length;
  const invalidSelectedTitle = rows.some(
    (row) => row.selected && !row.title.trim(),
  );
  const isDirty = baseline !== "" && breakdownDraftValue(rows) !== baseline;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <AiButton
        label="Break down"
        loadingLabel="Thinking..."
        loading={loading}
        ariaLabel={`Break down ${task.title}`}
        className="h-8 gap-1 px-2 text-xs"
        onClick={start}
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Break down task</DialogTitle>
          <DialogDescription>
            Edit the subtasks, then choose which ones to add to “{task.title}”.
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <p role="status" className="py-6 text-center text-sm text-slate-500">
            Thinking...
          </p>
        )}
        {error !== null && (
          <AiError error={error} onRetry={() => void generate()} />
        )}
        {rows.length > 0 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <BreakdownEditor
              rows={rows}
              dirty={isDirty}
              loading={loading}
              onUpdate={updateRow}
              onRemove={(key) =>
                setRows((current) =>
                  current.filter((item) => item.key !== key),
                )
              }
              onAdd={() =>
                setRows((current) => [
                  ...current,
                  {
                    key: nextKey.current++,
                    selected: true,
                    title: "",
                    description: "",
                  },
                ])
              }
              onRegenerate={() => {
                setRows([]);
                setBaseline("");
                void generate();
              }}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting ||
                  selectedCount === 0 ||
                  invalidSelectedTitle ||
                  selectedCount > 30
                }
              >
                {submitting ? "Adding..." : `Add ${selectedCount} subtasks`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
