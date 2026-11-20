"use client";

import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AiButton } from "@/components/ai/ai-button";
import { AiError } from "@/components/ai/ai-error";
import {
  ImproveFieldsForm,
  type ImproveFields,
} from "@/components/ai/improve-fields-form";
import { useAiRequest } from "@/hooks/use-ai-request";
import { aiImprove } from "@/lib/api";
import { localToday } from "@/lib/dates";
import type {
  AiImproveRequest,
  AiImproveResponse,
  TaskCreateInput,
} from "@/lib/types";

interface ImproveDialogProps {
  title: string;
  disabled?: boolean;
  onCreate: (
    input: TaskCreateInput,
    originalTitle: string,
  ) => Promise<boolean>;
}

function toFields(suggestion: AiImproveResponse): ImproveFields {
  return {
    title: suggestion.title,
    description: suggestion.description ?? "",
    priority: suggestion.priority,
    dueDate: suggestion.due_date ?? "",
  };
}

export function ImproveDialog({
  title,
  disabled = false,
  onCreate,
}: ImproveDialogProps) {
  const { run, loading, error, reset } =
    useAiRequest<AiImproveRequest, AiImproveResponse>(aiImprove);
  const [open, setOpen] = useState(false);
  const [originalTitle, setOriginalTitle] = useState("");
  const [requestInput, setRequestInput] = useState<AiImproveRequest | null>(
    null,
  );
  const [fields, setFields] = useState<ImproveFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");

  async function generate(input: AiImproveRequest) {
    const suggestion = await run(input);
    if (suggestion) setFields(toFields(suggestion));
  }

  function startImprove() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const input = { title: cleanTitle, today: localToday() };
    setOriginalTitle(cleanTitle);
    setRequestInput(input);
    setFields(null);
    setValidationError("");
    setOpen(true);
    void generate(input);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
      setFields(null);
    }
    setOpen(nextOpen);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fields) return;
    const cleanTitle = fields.title.trim();
    if (!cleanTitle || cleanTitle.length > 200) {
      setValidationError("Enter a title between 1 and 200 characters.");
      return;
    }

    setSaving(true);
    setValidationError("");
    const saved = await onCreate(
      {
        title: cleanTitle,
        description: fields.description.trim() || null,
        priority: fields.priority,
        due_date: fields.dueDate || null,
      },
      originalTitle,
    );
    setSaving(false);
    if (saved) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <AiButton
        label="Improve"
        loadingLabel="Improving..."
        loading={loading}
        disabled={disabled || !title.trim()}
        ariaLabel="Improve task writing with AI"
        onClick={startImprove}
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Improve task writing</DialogTitle>
          <DialogDescription>
            Review and edit the suggestion before creating a task.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Original:</span>{" "}
          {originalTitle}
        </p>
        {loading && (
          <p role="status" className="py-6 text-center text-sm text-slate-500">
            Thinking...
          </p>
        )}
        {error !== null && (
          <AiError
            error={error}
            onRetry={() => {
              if (requestInput) void generate(requestInput);
            }}
          />
        )}
        {fields && (
          <ImproveFieldsForm
            fields={fields}
            saving={saving}
            validationError={validationError}
            onChange={(patch) =>
              setFields((current) =>
                current ? { ...current, ...patch } : current,
              )
            }
            onSubmit={handleCreate}
            onDiscard={() => handleOpenChange(false)}
          />
        )}
        {!fields && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Discard
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
